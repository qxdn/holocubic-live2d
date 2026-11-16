local M = {}

function M.create(app_state, config, view, tts, speech)
  local render_timer = tmr.create()
  local live = false
  local reply, motion_played, dirty

  local function render()
    if not dirty then return end
    dirty = false
    view.render(app_state.messages)
  end

  local function clean()
    live = false
    render_timer:unregister()
    local connection = app_state.request
    app_state.request = nil
    if connection then
      pcall(connection.close, connection)
    end
    tts.clean()
    app_state.busy = false
  end

  local function fail(message)
    clean()
    render()
    speech.resume()
    print("[live2d] chat failed", message)
    view.set_status(message)
  end

  local function request()
    live = true
    local line_buffer, event_lines = "", {}
    local finished, audio_ended, done = false, false, false
    local response_done, playback_done = false, false
    local status = 0
    reply, motion_played, dirty = nil, false, false
    local messages = {}
    for index, message in ipairs(app_state.messages) do
      messages[index] = {
        id = "message-" .. index, role = message.role,
        parts = { { type = "text", text = message.content } },
      }
    end

    local function complete()
      if not live or app_state.stopped or not response_done or not playback_done then return end
      live = false
      render_timer:unregister()
      render()
      app_state.busy = false
      speech.resume()
      view.set_status("正在聆听")
    end

    local function receive_event(raw)
      if raw == "[DONE]" then done = true return end
      local event = sjson.decode(raw)
      if type(event) ~= "table" then error("invalid chat event") end
      if event.type == "text-delta" then
        if type(event.delta) ~= "string" then error("invalid text delta") end
        if not reply then
          reply = { role = "assistant", content = "" }
          table.insert(app_state.messages, reply)
        end
        reply.content = reply.content .. event.delta
        dirty = true
        if not motion_played then
          local motion = reply.content:match("<motion>%s*([%w_-]+)%s*</motion>")
          if motion then
            motion_played = true
            view.play_action(motion, "motion_tag")
          end
        end
      elseif event.type == "data-audio" then
        tts.push(event.data)
        view.set_status("正在播放…")
      elseif event.type == "data-audio-end" then
        audio_ended = true
        tts.finish()
      elseif event.type == "finish" then
        finished = true
      elseif event.type == "error" then
        error(event.errorText or "回复失败")
      elseif event.type == "abort" then
        error("回复已取消")
      end
    end

    local function receive(data)
      line_buffer = line_buffer .. data
      while true do
        local newline = line_buffer:find("\n", 1, true)
        if not newline then break end
        local line = line_buffer:sub(1, newline - 1):gsub("\r$", "")
        line_buffer = line_buffer:sub(newline + 1)
        if line == "" then
          if #event_lines > 0 then receive_event(table.concat(event_lines, "\n")) end
          event_lines = {}
        elseif line:sub(1, 5) == "data:" then
          event_lines[#event_lines + 1] = line:sub(6):gsub("^ ", "")
        end
      end
      if #line_buffer > 256 * 1024 then error("chat event too large") end
    end

    local ok, err = pcall(function()
      tts.begin(function()
        playback_done = true
        complete()
      end, fail)
      render_timer:alarm(200, tmr.ALARM_AUTO, render)
      local url = config.api_url:gsub("/v1/chat/completions/?$", "/chat")
      local connection = http.createConnection(url, "POST", {
        async = true, timeout = config.timeout_ms, bufsz = 16384,
        headers = { ["Content-Type"] = "application/json", Accept = "text/event-stream" },
      })
      app_state.request = connection
      connection:setbody(sjson.encode({ characterId = config.character_id, enableTts = true, messages = messages }))
      connection:on("headers", function(code)
        if not live or app_state.request ~= connection then connection:close() return end
        status = code
        if code ~= 200 then fail("请求失败：" .. tostring(code)) end
      end)
      connection:on("data", function(code, data)
        if not live or app_state.request ~= connection or app_state.stopped or app.exiting() then
          connection:close()
          return
        end
        if code ~= 200 then fail("请求失败：" .. tostring(code)) return end
        local received, why = pcall(receive, data)
        if not received then fail(tostring(why)) return end
      end)
      connection:on("complete", function()
        if not live or app_state.request ~= connection then return end
        app_state.request = nil
        if status ~= 200 or not done or not finished or not audio_ended then
          fail("语音回复中断：" .. tostring(status))
          return
        end
        render_timer:unregister()
        render()
        response_done = true
        complete()
      end)
      connection:request()
    end)
    if not ok then fail(tostring(err)) end
  end

  local function send(input_text)
    if app_state.stopped or app_state.busy or app.exiting() then return end
    local text = (input_text or view.get_input()):gsub("^%s+", ""):gsub("%s+$", "")
    if text == "" then return end
    table.insert(app_state.messages, { role = "user", content = text })
    view.set_input("")
    view.render(app_state.messages)
    app_state.busy = true
    view.set_status("正在思考…")
    request()
  end

  return { send = send, clean = clean }
end

return M
