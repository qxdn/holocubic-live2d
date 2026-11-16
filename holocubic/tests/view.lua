-- Run from the repository root with Lua 5.3+.
local markdown = dofile("holocubic/live2d/markdown.lua")
for _, tag in ipairs({ "<motion>wave</motion>", "[tool:wave]" }) do
  for length = 1, #tag do
    assert(markdown.to_text("hello " .. tag:sub(1, length)) == "hello",
      "partial tag leaked: " .. tag:sub(1, length))
  end
  assert(markdown.to_text("hello " .. tag .. " world") == "hello  world")
end
assert(markdown.to_text("1 < 2") == "1 < 2")
assert(markdown.to_text("**hello**") == "hello")

local next_id, deleted, updates = 0, 0, 0
local texts, timers = {}, {}
local constants = {
  "LV_PART_MAIN", "LV_STATE_DEFAULT", "LV_OBJ_FLAG_SCROLLABLE", "LV_LABEL_LONG_WRAP",
  "LV_FONT_MONTSERRAT_14", "LV_SIZE_CONTENT", "LV_FLEX_FLOW_ROW", "LV_FLEX_FLOW_COLUMN",
  "LV_FLEX_ALIGN_END", "LV_FLEX_ALIGN_START", "LV_DIR_VER",
}
for _, name in ipairs(constants) do _G[name] = 0 end
local function object() next_id = next_id + 1 return next_id end
lv_obj_create, lv_label_create = object, object
lv_scr_act = function() return 0 end
lv_font_load = function() return nil end
lv_label_set_text = function(id, text) texts[id] = text; updates = updates + 1 end
lv_obj_del = function() deleted = deleted + 1 end
lv_obj_get_y = function() return 0 end
for _, name in ipairs({
  "lv_obj_set_style_bg_color", "lv_obj_set_style_bg_opa", "lv_obj_set_style_border_width",
  "lv_obj_set_style_radius", "lv_obj_clear_flag", "lv_obj_set_pos", "lv_obj_set_size",
  "lv_obj_set_style_text_font", "lv_obj_set_style_text_color", "lv_label_set_long_mode",
  "lv_obj_set_style_pad_all", "lv_obj_set_flex_flow", "lv_obj_set_flex_align",
  "lv_obj_set_width", "lv_obj_set_height", "lv_obj_scroll_to_view", "lv_obj_clean",
  "lv_obj_set_style_pad_row", "lv_obj_add_flag", "lv_obj_set_scroll_dir",
}) do _G[name] = function() end end
tmr = { ALARM_SINGLE = 0, create = function()
  local timer = { stop = function() end, unregister = function() end }
  function timer:alarm(_, _, callback) self.callback = callback end
  timers[#timers + 1] = timer
  return timer
end }
app = { exiting = function() return false end }
local original_dofile = dofile
dofile = function(path)
  if path:match("/frame2d.lua$") then
    return { create = function() return { play = function() end, clean = function() end } end }
  end
  return original_dofile(path)
end
local view = dofile("holocubic/live2d/view.lua").create("holocubic/live2d")
local messages = { { role = "user", content = "hi" }, { role = "assistant", content = "hello" } }
view.render(messages)
local objects_before, deletes_before, updates_before = next_id, deleted, updates
messages[2].content = "hello world"
view.render(messages)
assert(next_id == objects_before and deleted == deletes_before, "stream delta rebuilt a bubble")
assert(updates == updates_before + 1, "delta must update only one label")
updates_before = updates
messages[2].content = "hello world<motion>wav"
view.render(messages)
assert(updates == updates_before, "hidden tag should not redraw text")
messages[2].content = "hello world<motion>wave</motion>!"
view.render(messages)
assert(next_id == objects_before and deleted == deletes_before)
messages[3] = { role = "user", content = "again" }
view.render(messages)
assert(next_id > objects_before, "new message must create a bubble")
timers[1].callback()
messages[3] = nil
view.render(messages)
view.clean()
print("view and streaming tag tests passed")
