local M = {}

local RATE = 24000
local BLOCK_BYTES = 4096
local LOW_WATER_BYTES = 12000 -- 250 ms at 24 kHz mono PCM16.
local PREBUFFER_BYTES = 48000 -- One second before starting or resuming delivery.
local DMA_BYTES = 12 * 1024 * 2
local SILENCE = string.rep("\0", BLOCK_BYTES)
local ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local VALUES = {}
for i = 1, #ALPHABET do VALUES[ALPHABET:byte(i)] = i - 1 end

local function decode_base64(value)
  if type(value) ~= "string" or #value % 4 ~= 0 then error("invalid Base64 audio") end
  local result, bytes, count = {}, {}, 0
  for i = 1, #value, 4 do
    local ca, cb, c, d = value:byte(i, i + 3)
    local a, b = VALUES[ca], VALUES[cb]
    if not a or not b or (c ~= 61 and not VALUES[c]) or (d ~= 61 and not VALUES[d])
      or (c == 61 and d ~= 61) or ((c == 61 or d == 61) and i + 3 ~= #value) then
      error("invalid Base64 audio")
    end
    local n = (a << 18) | (b << 12) | ((VALUES[c] or 0) << 6) | (VALUES[d] or 0)
    count = count + 1
    bytes[count] = (n >> 16) & 255
    if c ~= 61 then count = count + 1; bytes[count] = (n >> 8) & 255 end
    if d ~= 61 then count = count + 1; bytes[count] = n & 255 end
    -- Batch conversion avoids allocating a string for every three PCM bytes.
    if count >= 192 or i + 3 == #value then
      result[#result + 1] = string.char(table.unpack(bytes, 1, count))
      count = 0
    end
  end
  return table.concat(result)
end

function M.create(speech, audio)
  local queue = { chunks = {}, head = 1, count = 0, offset = 1, bytes = 0, capacity = 64 }
  local ended, inflight, drain_bytes = false, false, 0
  local underruns = 0
  local buffering = false
  local on_done, on_error
  local received_bytes, written_bytes = 0, 0

  local function clean()
    pcall(audio.stop, "tx")
    ended, inflight, drain_bytes = false, false, 0
    buffering = false
    queue.chunks = {}
    queue.head, queue.count, queue.offset, queue.bytes = 1, 0, 1, 0
    on_done, on_error = nil, nil
  end

  local function enqueue(pcm)
    if queue.count == queue.capacity then
      local chunks = {}
      for index = 1, queue.count do
        chunks[index] = queue.chunks[(queue.head + index - 2) % queue.capacity + 1]
      end
      queue.chunks, queue.head, queue.capacity = chunks, 1, queue.capacity * 2
    end
    local tail = (queue.head + queue.count - 1) % queue.capacity + 1
    queue.chunks[tail] = pcm
    queue.count, queue.bytes = queue.count + 1, queue.bytes + #pcm
  end

  local function dequeue()
    local parts, remaining = {}, math.min(BLOCK_BYTES, queue.bytes)
    while remaining > 0 do
      local chunk = queue.chunks[queue.head]
      local count = math.min(remaining, #chunk - queue.offset + 1)
      parts[#parts + 1] = count == #chunk and chunk or chunk:sub(queue.offset, queue.offset + count - 1)
      queue.offset, remaining, queue.bytes = queue.offset + count, remaining - count, queue.bytes - count
      if queue.offset > #chunk then
        queue.chunks[queue.head] = nil
        queue.head, queue.count, queue.offset = queue.head % queue.capacity + 1, queue.count - 1, 1
      end
    end
    return #parts == 1 and parts[1] or table.concat(parts)
  end

  local function pump()
    if audio.mode ~= "tx" or inflight then return end
    local pcm
    if queue.bytes < LOW_WATER_BYTES and not ended and not buffering then
      buffering = true
      drain_bytes = 0
      underruns = underruns + 1
      print("[live2d] tts buffering", "underruns", underruns)
    end
    if buffering and (ended or queue.bytes >= PREBUFFER_BYTES) then
      buffering, drain_bytes = false, 0
    end
    -- Like the music player's consumer, wait without closing the I2S stream.
    -- push/finish wake delivery once enough PCM or the final tail is available.
    if buffering then return end
    if queue.bytes == 0 then
      -- Flush all DMA buffers with silence before switching back to RX.
      if ended and drain_bytes >= DMA_BYTES then
        local done = on_done
        print("[live2d] tts playback complete", "received", received_bytes, "written", written_bytes, "underruns", underruns)
        clean()
        if done then done() end
        return
      end
      drain_bytes = drain_bytes + BLOCK_BYTES
      pcm = SILENCE
    else
      drain_bytes = 0
      pcm = dequeue()
    end
    inflight = true
    local ok, err = pcall(i2s.write, audio.port, pcm)
    if not ok or err == false then
      local failed = on_error
      clean()
      if failed then failed(tostring(err)) end
    else
      written_bytes = written_bytes + #pcm
    end
  end

  local function start_playback()
    if audio.mode == "tx" then pump() return end
    if queue.bytes == 0 or (not ended and queue.bytes < PREBUFFER_BYTES) then return end
    buffering, drain_bytes = false, 0
    audio.start("tx", function()
      inflight = false
      pump()
    end)
    print("[live2d] tts i2s started", RATE, "mono", "data_out_pin", audio.config.data_out_pin)
    pump()
  end

  local function begin(done, failed)
    clean()
    speech.pause()
    received_bytes, written_bytes, underruns = 0, 0, 0
    on_done, on_error = done, failed
  end

  local function push(data)
    if ended then error("audio received after synthesis ended") end
    if type(data) ~= "table" or data.format ~= "pcm_s16le" or data.sampleRate ~= RATE or data.channels ~= 1 then
      error("unsupported TTS audio format")
    end
    local pcm = decode_base64(data.audio)
    if #pcm % 2 ~= 0 then error("unaligned PCM16 audio") end
    if #pcm == 0 then return end
    enqueue(pcm)
    received_bytes = received_bytes + #pcm
    if received_bytes == #pcm then print("[live2d] tts first audio", #pcm, "bytes") end
    start_playback()
  end

  local function finish()
    ended = true
    print("[live2d] tts synthesis complete", received_bytes, "bytes", "queued", queue.bytes)
    start_playback()
    if audio.mode ~= "tx" then
      local done = on_done
      clean()
      if done then done() end
    end
  end

  return {
    begin = begin, push = push, finish = finish, clean = clean,
  }
end

return M
