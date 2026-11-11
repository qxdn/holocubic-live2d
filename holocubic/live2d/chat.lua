local M = {}

function M.create(app_state, config, view)
  local function send(input_text)
    if app_state.stopped or app_state.busy or app.exiting() then return end
    local text = (input_text or view.get_input()):gsub("^%s+", ""):gsub("%s+$", "")
    if text == "" then return end

    table.insert(app_state.messages, { role = "user", content = text })
    view.set_input("")
    view.render(app_state.messages)
    app_state.busy = true
    view.set_status("正在连接…")

    local body = sjson.encode({
      model = config.character_id,
      messages = app_state.messages,
      stream = false,
    })
    print("[live2d] chat request", config.api_url)
    local ok, request = pcall(http.post, config.api_url, {
      timeout = config.timeout_ms,
      headers = {
        ["Content-Type"] = "application/json",
        Accept = "application/json",
      },
    }, body, function(code, response)
      print("[live2d] chat response", tostring(code), type(response) == "string" and response or tostring(response))
      if app_state.stopped or app.exiting() then return end
      app_state.busy = false
      app_state.request = nil

      local decoded, result = false, nil
      if code == 200 and type(response) == "string" then
        decoded, result = pcall(sjson.decode, response)
      end
      local answer = decoded and type(result) == "table"
        and type(result.choices) == "table" and result.choices[1]
        and result.choices[1].message and result.choices[1].message.content
      if type(answer) == "string" then
        table.insert(app_state.messages, { role = "assistant", content = answer })
        view.set_status("已回复")
      else
        table.remove(app_state.messages)
        view.set_status("请求失败：" .. tostring(code or "网络错误"))
      end
      view.render(app_state.messages)
    end)

    if not ok then
      print("[live2d] chat request error", tostring(request))
      app_state.busy = false
      table.remove(app_state.messages)
      view.render(app_state.messages)
      view.set_status("请求失败")
    else
      app_state.request = request
    end
  end

  return { send = send }
end

return M
