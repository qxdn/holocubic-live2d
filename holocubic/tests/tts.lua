-- Run from the repository root with Lua 5.3+.
local timers, writes = {}, {}
local starts, stops, pauses, resumes, renders = 0, 0, 0, 0, 0
local last_status, action, connection, request_body
local events = {}
local tx_callback, pending_tx
tmr = { ALARM_AUTO = 1, ALARM_SINGLE = 0 }
function tmr.create()
  local timer = {}
  function timer:stop() self.running = false end
  function timer:unregister() self.running = false end
  function timer:alarm(ms, mode, callback)
    self.running, self.callback, self.mode, self.ms = true, callback, mode, ms
  end
  timers[#timers + 1] = timer
  return timer
end
local function tick()
  local callback = pending_tx
  pending_tx = nil
  if callback then callback(0, "tx") end
  for _, timer in ipairs(timers) do
    if timer.running then
      if timer.mode == tmr.ALARM_SINGLE then timer.running = false end
      timer.callback()
    end
  end
end
i2s = { MODE_MASTER = 1, MODE_TX = 2, CHANNEL_ONLY_LEFT = 1, FORMAT_I2S = 1 }
function i2s.start(_, cfg, callback)
  assert(cfg.rate == 24000 and cfg.bits == 16)
  assert(cfg.data_out_pin == 48, "speaker output must use GPIO 48")
  assert(cfg.buffer_count == 12 and type(callback) == "function")
  assert(cfg.buffer_len == 1024)
  tx_callback = callback
  starts = starts + 1
end
function i2s.stop() stops = stops + 1; pending_tx = nil end
function i2s.write(_, pcm)
  writes[#writes + 1] = pcm
  pending_tx = tx_callback
end
app = { exiting = function() return false end }
sjson = {
  encode = function(value) request_body = value return "request" end,
  decode = function(value) assert(events[value], "invalid JSON") return events[value] end,
}
http = {}
function http.createConnection(url, method, options)
  assert(url == "http://server/api/chat" and method == "POST" and options.async)
  local c = { callbacks = {} }
  function c:on(event, callback) self.callbacks[event] = callback end
  function c:setbody() end
  function c:request() end
  function c:close() self.closed = true end
  connection = c
  return c
end
local speech = {
  pause = function() pauses = pauses + 1 end,
  resume = function() resumes = resumes + 1 end,
}
local view = {
  render = function() renders = renders + 1 end,
  set_status = function(value) last_status = value end,
  set_input = function() end,
  play_action = function(value) action = value end,
}
local state = { messages = {}, busy = false }
local audio_device = dofile("holocubic/live2d/audio.lua").create()
local tts = dofile("holocubic/live2d/tts.lua").create(speech, audio_device)
local chat = dofile("holocubic/live2d/chat.lua").create(state, {
  api_url = "http://server/api/v1/chat/completions", character_id = "whale", timeout_ms = 60000,
}, view, tts, speech)
local function emit(name, event)
  events[name] = event
  return connection.callbacks.data(200, "data: " .. name .. "\n\n")
end
local function start()
  chat.send("hello")
  connection.callbacks.headers(200, {})
  assert(state.busy)
end
local function ending()
  emit("audio-end", { type = "data-audio-end" })
  emit("finish", { type = "finish" })
  connection.callbacks.data(200, "data: [DONE]\n\n")
  connection.callbacks.complete()
end
local function audio(value)
  return { type = "data-audio", data = {
    audio = value, format = "pcm_s16le", sampleRate = 24000, channels = 1,
  } }
end

start()
assert(request_body.enableTts and request_body.characterId == "whale")
assert(request_body.messages[1].parts[1].text == "hello")
events.text = { type = "text-delta", delta = "Hi <motion>wave</motion>" }
-- Split both the SSE prefix and CRLF across HTTP callbacks.
connection.callbacks.data(200, "da")
connection.callbacks.data(200, "ta: text\r")
connection.callbacks.data(200, "\n\r\n")
assert(action == "wave" and state.messages[2].content == events.text.delta)
emit("audio", audio("AAABAP//"))
emit("padded1", audio("AQI="))
emit("padded2", audio("AAECAw=="))
local all_bytes = {}
for value = 0, 255 do all_bytes[#all_bytes + 1] = string.char(value) end
emit("all-bytes", audio("AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w=="))
assert(starts == 0, "buffer short audio until synthesis finishes")
ending()
assert(state.busy and resumes == 0, "HTTP completion must not cut off playback")
assert(table.concat(writes) == "\0\0\1\0\255\255\1\2\0\1\2\3" .. table.concat(all_bytes))
tick()
assert(state.busy, "wait for DMA drain")
for _ = 1, 6 do tick() end
assert(not state.busy and resumes == 1 and stops == 1)
print("PASS: split SSE, motion, ordered PCM, drain before RX")

start()
for index = 1, 8 do
  local result = emit("long-audio-" .. index, audio(string.rep("AAAA", 32000)))
  assert(result == nil and state.busy, "keep receiving beyond the old queue limits")
  emit("long-text-" .. index, { type = "text-delta", delta = "part " .. index .. " " })
end
ending()
for _ = 1, 200 do tick() end
assert(not state.busy and state.messages[#state.messages].content:find("part 8"),
  "a long reply must receive all text and drain all audio")
print("PASS: continuous long response with 768000 PCM bytes")

start()
emit("cancel-audio", audio(string.rep("AAAA", 32000)))
local current, old_tx = connection, tx_callback
chat.clean()
assert(not state.busy and current.closed)
local count = #writes
old_tx(0, "tx")
assert(#writes == count, "ignore late TX callbacks after cancellation")
print("PASS: cancellation")

start()
local before_start, before_resume, before_stop = starts, resumes, stops
local write_start = #writes
emit("buffered", audio(string.rep("AAAA", 32000)))
assert(starts == before_start + 1)
for _ = 1, 36 do tick() end
assert(state.busy and resumes == before_resume and not pending_tx,
  "low water must wait for PCM without resuming the microphone")
assert(stops == before_stop, "buffering must keep the I2S stream open")
local count_before = #writes
emit("small-refill", audio("AAABAP//"))
tick()
assert(#writes == count_before and starts == before_start + 1,
  "a tiny refill must not restart playback")
-- Refill must wake the consumer even though there are no pending TX callbacks.
emit("refill", audio(string.rep("AQID", 16000)))
assert(pending_tx and starts == before_start + 1 and stops == before_stop,
  "refill must continue on the existing I2S stream")
for _ = 1, 36 do tick() end
assert(not pending_tx and stops == before_stop)
-- A short final tail must still play below the resume threshold.
emit("final-tail", audio("AAABAP//"))
ending()
assert(starts == before_start + 1)
for _ = 1, 16 do tick() end
assert(not state.busy and resumes == before_resume + 1)
local played = table.concat(writes, "", write_start + 1)
assert(played == string.rep("\0", 96000) .. "\0\0\1\0\255\255" ..
  string.rep("\1\2\3", 16000) .. "\0\0\1\0\255\255" .. string.rep("\0", 24576),
  "buffering must preserve every PCM byte and add silence only for final drain")
assert(stops == before_stop + 1, "stop I2S only after final drain")
print("PASS: low water, refill without I2S restart, short final tail")

start()
local resume_before_end = resumes
emit("short-audio", audio("AAABAP//"))
emit("early-audio-end", { type = "data-audio-end" })
for _ = 1, 8 do tick() end
assert(state.busy and resumes == resume_before_end,
  "playback can drain before HTTP completes, but the microphone must stay paused")
emit("finish", { type = "finish" })
connection.callbacks.data(200, "data: [DONE]\n\n")
connection.callbacks.complete()
assert(not state.busy and resumes == resume_before_end + 1)
print("PASS: audio end drains independently of HTTP completion")

start()
local ring_start, expected = #writes, {}
for index = 1, 400 do
  local encoded = index % 2 == 0 and "AQID" or "BAUG"
  expected[#expected + 1] = string.rep(index % 2 == 0 and "\1\2\3" or "\4\5\6", 160)
  emit("ring-" .. index, audio(string.rep(encoded, 160)))
  if index == 200 then for _ = 1, 10 do tick() end end
end
ending()
for _ = 1, 80 do tick() end
assert(not state.busy)
assert(table.concat(writes, "", ring_start + 1) == table.concat(expected) .. string.rep("\0", 24576),
  "ring wrap and growth must preserve every PCM byte")
print("PASS: PCM ring wrap and growth with 400 audio chunks")

start()
emit("bad-audio", audio("!!!!"))
assert(not state.busy and connection.closed and last_status:find("Base64"))
-- Late callbacks from a failed request must not affect its successor.
local old = connection
start()
old.callbacks.complete()
assert(state.busy and state.request == connection)
connection.callbacks.complete()
assert(not state.busy and last_status:find("中断"))
print("PASS: malformed audio, stale callbacks, truncated stream")

start()
ending()
assert(not state.busy, "empty synthesis must complete without starting TX")
start()
emit("error", { type = "error", errorText = "provider failed" })
assert(not state.busy and last_status:find("provider failed"))
start()
emit("audio2", audio("AAABAP//"))
i2s.write = function() error("speaker failed") end
ending()
assert(not state.busy and last_status:find("speaker failed"))
chat.clean()
for _, timer in ipairs(timers) do assert(not timer.running) end
print("PASS: empty audio, provider error, I2S error, cleanup")
