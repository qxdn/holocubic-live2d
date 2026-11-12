local M = {}

function M.create(app_state, config, view)
  local function fail(message)
    app_state.busy = false
    app_state.request = nil
    print("[live2d] chat failed", message)
    view.set_status(message)
    -- Preserve bubbles and animation on errors.
  end

  local function request()
    if app_state.stopped or app.exiting() then return end
    local body = sjson.encode({ model = config.character_id, messages = app_state.messages, stream = false })
    local completed = false
    local ok, handle = pcall(http.post, config.api_url, {
      timeout = config.timeout_ms,
      headers = { ["Content-Type"] = "application/json", Accept = "application/json" },
    }, body, function(code, response)
      completed = true
      print("[live2d] chat response", tostring(code), tostring(response))
      if app_state.stopped or app.exiting() then return end
      app_state.request = nil
      local decoded, result = false, nil
      if code == 200 and type(response) == "string" then decoded, result = pcall(sjson.decode, response) end
      if not decoded or type(result) ~= "table" then fail("请求失败：" .. tostring(code)) return end
      if result.success == false then fail(result.message or "请求失败") return end
      local choice = type(result.choices) == "table" and result.choices[1]
      local message = choice and choice.message
      if type(message) ~= "table" then fail("回复格式错误") return end
      local text = type(message.content) == "string" and message.content or ""
      local motion = text:match("<motion>%s*([%w_-]+)%s*</motion>")
      if motion then
        print("[live2d] motion tag", motion)
        view.play_action(motion, "motion_tag")
      end
      if text ~= "" then
        table.insert(app_state.messages, { role = "assistant", content = text })
        view.render(app_state.messages)
      end
      app_state.busy = false
      view.set_status("已回复")
    end)
    if not ok then fail("请求失败：" .. tostring(handle))
    elseif not completed then app_state.request = handle end
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

  return { send = send }
end

return M
