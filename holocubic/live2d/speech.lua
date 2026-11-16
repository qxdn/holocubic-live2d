local M = {}

local SAMPLE_RATE = 16000
local CHUNK_BYTES = 1024 -- 32 ms of mono PCM16

local function encode_query(value)
  return tostring(value):gsub("([^%w%-_%.~])", function(char)
    return string.format("%%%02X", string.byte(char))
  end)
end

local function stream_url(config)
  local url = config.api_url:gsub("/v1/chat/completions/?$", "/speech/stream")
  url = url:gsub("^https://", "wss://"):gsub("^http://", "ws://")
  local separator = url:find("?", 1, true) and "&" or "?"
  return url .. separator .. "characterId=" .. encode_query(config.character_id)
end

function M.create(app_state, config, view, audio, on_transcript)
  local client
  local reconnect_timer = tmr.create()
  local paused = false
  local ready = false
  local start_recording
  local start
  local connected_at = 0
  local sent_bytes = 0

  local function schedule_reconnect()
    if app_state.stopped or app.exiting() then return end
    print("[live2d] speech ws reconnecting in 3s")
    view.set_status("语音断开，准备重连")
    reconnect_timer:alarm(3000, tmr.ALARM_SINGLE, function()
      if not app_state.stopped then start() end
    end)
  end

  local function receive_message(data)
    if type(data) ~= "string" then return end
    print("[live2d] speech ws rx", data)
    local ok, message = pcall(sjson.decode, data)
    if not ok or type(message) ~= "table" then return end

    if message.type == "ready" then
      ready = true
      start_recording()
      if paused then return end
      view.set_status("正在聆听")
      view.set_hint("直接说话，停顿后自动识别并发送")
      return
    end
    if message.type == "transcript" and type(message.text) == "string" then
      local text = message.text:gsub("^%s+", ""):gsub("%s+$", "")
      if text ~= "" and not app_state.busy then
        view.set_input(text)
        view.set_status("已识别，正在回复…")
        on_transcript(text)
      end
      return
    end
    if message.type == "error" then
      view.set_status(message.message or "语音识别失败")
    end
  end

  start_recording = function()
    if audio.mode == "rx" or paused or app_state.stopped then return end
    local ok, err = pcall(audio.start, "rx", function(i2s_num)
      if app_state.stopped then return end
      local read_ok, data = pcall(i2s.read, i2s_num, CHUNK_BYTES, 10)
      if not read_ok then
        print("[live2d] i2s read error", tostring(data))
        return
      end
      if type(data) ~= "string" or #data == 0 then return end
      if ready and not paused and not app_state.busy and client then
        local sent, send_error = pcall(client.send, client, data, websocket.BINARY)
        if not sent then print("[live2d] speech ws send error", tostring(send_error)) end
        if sent then sent_bytes = sent_bytes + #data end
      end
    end)
    if not ok then
      print("[live2d] i2s start error", tostring(err))
      view.set_status("麦克风启动失败")
      view.set_hint(tostring(err or "检查 I2S GPIO 与固件支持"))
      return
    end
    print("[live2d] i2s started", audio.port, SAMPLE_RATE, 16, "mono")
  end

  local function stop_recording()
    pcall(audio.stop, "rx")
  end

  start = function()
    if app_state.stopped or client then return end
    local ok, value = pcall(websocket.createClient)
    if not ok or not value then
      print("[live2d] speech ws client create failed", tostring(value))
      view.set_status("WebSocket 初始化失败")
      schedule_reconnect()
      return
    end
    client = value
    print("[live2d] speech ws connecting", stream_url(config))
    client:on("connection", function()
      connected_at, sent_bytes = tmr.time(), 0
      print("[live2d] speech ws connected")
      view.set_status("正在连接语音服务…")
    end)
    client:on("receive", function(first, second)
      receive_message(type(second) == "string" and second or first)
    end)
    client:on("close", function(_, code)
      print("[live2d] speech ws closed", "code", tostring(code),
        "seconds", tmr.time() - connected_at, "attempted_bytes", sent_bytes)
      client = nil
      ready = false
      stop_recording()
      if not app_state.stopped then
        view.set_status("语音服务连接断开")
        schedule_reconnect()
      end
    end)

    local connected, connect_error = pcall(client.connect, client, stream_url(config))
    if not connected then
      print("[live2d] speech ws connect error", tostring(connect_error))
      client = nil
      view.set_status("语音服务连接失败")
      view.set_hint(tostring(connect_error))
      schedule_reconnect()
    end
  end

  local function clean()
    ready = false
    reconnect_timer:unregister()
    stop_recording()
    if client then
      pcall(client.close, client)
      client = nil
    end
  end

  local function pause()
    paused = true
    stop_recording()
  end

  local function resume()
    paused = false
    if ready then start_recording() end
  end

  return { start = start, clean = clean, pause = pause, resume = resume }
end

return M
