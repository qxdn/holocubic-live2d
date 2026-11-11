local APP_KEY = "HOLOCUBIC_LIVE2D_CHAT"
local APP = { stopped = false, busy = false, messages = {}, request = nil }

local function app_directory()
  local current = app.current()
  local id = type(current) == "table" and (current.id or current.app_id)
  if type(id) == "string" and id ~= "" then return "/sd/apps/" .. id end
  return "/sd/apps/live2d"
end

local function load_module(directory, name)
  local module = dofile(directory .. "/" .. name .. ".lua")
  if type(module) ~= "table" then error("invalid app module: " .. name) end
  return module
end

local function stop_previous()
  local previous = rawget(_G, APP_KEY)
  if previous and previous.stop then previous.stop() end
end

local function start()
  stop_previous()
  local directory = app_directory()
  local config = load_module(directory, "config").load(directory)
  local view = load_module(directory, "view").create(directory)
  local chat = load_module(directory, "chat").create(APP, config, view)
  local speech = load_module(directory, "speech").create(APP, config, view, chat)

  function APP.stop()
    if APP.stopped then return end
    APP.stopped = true
    if APP.request and APP.request.close then
      pcall(function() APP.request:close() end)
    end
    APP.request = nil
    APP.busy = false
    speech.clean()
    view.clean()
    if rawget(_G, APP_KEY) == APP then _G[APP_KEY] = nil end
  end

  APP.shutdown = APP.stop
  _G[APP_KEY] = APP
  view.render(APP.messages)
  speech.start()
end

start()
