-- SQLite 表结构；时间使用 Unix 毫秒时间戳，不创建外键。
-- group 和 index 从 .model3.json 解析，不在数据库中保存。
-- updated_at 由服务端在更新记录时维护。
-- Live2D 模型。
CREATE TABLE live2d_models (
    -- 稳定的模型标识，用于客户端选择模型。
    id TEXT PRIMARY KEY NOT NULL,
    -- 展示名称，允许重复。
    name TEXT NOT NULL,
    -- 模型入口文件 .model3.json 的资源地址。
    url TEXT NOT NULL,
    -- 创建和最后更新时间，单位为 Unix 毫秒。
    created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000)
);

-- 模型动作定义；播放分组和索引由客户端解析模型文件。
CREATE TABLE live2d_motions (
    -- 稳定的动作记录标识。
    id TEXT PRIMARY KEY NOT NULL,
    -- 逻辑关联 live2d_models.id，不创建外键。
    model_id TEXT NOT NULL,
    -- 动作名称，与前端动作表一致。
    name TEXT NOT NULL,
    -- 动作描述，供 Agent 判断何时调用。
    description TEXT NOT NULL DEFAULT '',
    -- 创建和最后更新时间，单位为 Unix 毫秒。
    created_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    updated_at INTEGER NOT NULL DEFAULT (CAST(strftime('%s', 'now') AS INTEGER) * 1000),
    -- 同一模型内的动作名称唯一。
    CONSTRAINT uq_live2d_motions_model_name UNIQUE (model_id, name)
);
