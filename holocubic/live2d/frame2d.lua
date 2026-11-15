local M = {}

function M.create(directory, parent)
  local timer = tmr.create()
  local actor
  local idle_actor
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
    -- Keep idle loaded so returning from an action needs no SD read or decode.
    local next_actor = name == "idle" and idle_actor or nil
    if not next_actor then
      next_actor = lv_gif_create(parent)
      lv_obj_add_flag(next_actor, LV_OBJ_FLAG_HIDDEN)
      lv_gif_set_src(next_actor, path)
      lv_obj_center(next_actor)
      if name == "idle" then idle_actor = next_actor end
    end
    lv_obj_clear_flag(next_actor, LV_OBJ_FLAG_HIDDEN)
    local previous = actor
    actor = next_actor
    if previous and previous ~= actor then
      if previous == idle_actor then
        lv_obj_add_flag(previous, LV_OBJ_FLAG_HIDDEN)
      else
        lv_obj_del(previous)
      end
    end
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
    if actor and actor ~= idle_actor then lv_obj_del(actor) end
    if idle_actor then lv_obj_del(idle_actor) end
    actor, idle_actor = nil, nil
  end

  return { play = play, clean = clean }
end

return M
