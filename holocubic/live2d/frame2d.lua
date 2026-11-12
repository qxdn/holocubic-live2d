local M = {}

function M.create(directory, parent)
  local timer = tmr.create()
  local actor = lv_gif_create(parent)
  local tracks = sjson.decode(file.getcontents(directory .. "/assets/animations.json"))
  local current
  local stopped = false
  local generation = 0

  local function play(name, reason)
    if stopped or app.exiting() then return end
    local track = tracks[name]
    local path = directory .. "/assets/" .. name .. ".gif"
    print("[live2d] action requested", name, "reason", reason)
    if not track or not file.exists(path) then
      print("[live2d] action missing", name, path)
      return false
    end
    if name == current and track.loop then return true end
    timer:stop()
    generation = generation + 1
    local playback = generation
    lv_gif_set_src(actor, path)
    lv_obj_center(actor)
    current = name
    print("[live2d] action play", name, "duration_ms", track.duration_ms, "loop", track.loop)
    if not track.loop then
      timer:alarm(track.duration_ms, tmr.ALARM_SINGLE, function()
        if stopped or playback ~= generation then return end
        print("[live2d] action complete", name)
        play("idle", "action_complete:" .. name)
      end)
    end
    return true
  end

  local function clean()
    if stopped then return end
    stopped = true
    generation = generation + 1
    timer:unregister()
    print("[live2d] action clean", current)
    lv_obj_del(actor)
  end

  return { play = play, clean = clean }
end

return M
