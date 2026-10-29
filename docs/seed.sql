-- Live2D 初始数据：模型路径、动作名称和描述与前端配置一致。
-- 在仓库根目录 data.db 执行；重复执行保留已有记录，不覆盖修改。
BEGIN;
-- Haru 模型及 6 个动作。
INSERT INTO live2d_models (id, name, url) VALUES ('haru', 'Haru', '/models/Haru/Haru.model3.json') ON CONFLICT(id) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('haru:haru_g_idle', 'haru', 'haru_g_idle', '默认待机动作，用于角色空闲时的自然表现。') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('haru:haru_g_m15', 'haru', 'haru_g_m15', '备用待机动作，用于角色空闲时变化姿态。') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('haru:haru_g_m26', 'haru', 'haru_g_m26', '身体触碰反应动作 m26；具体手势待确认。') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('haru:haru_g_m06', 'haru', 'haru_g_m06', '身体触碰反应动作 m06；具体手势待确认。') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('haru:haru_g_m20', 'haru', 'haru_g_m20', '身体触碰反应动作 m20；具体手势待确认。') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('haru:haru_g_m09', 'haru', 'haru_g_m09', '身体触碰反应动作 m09；具体手势待确认。') ON CONFLICT(model_id, name) DO NOTHING;
-- Hiyori 模型及 10 个动作。
INSERT INTO live2d_models (id, name, url) VALUES ('hiyori', 'Hiyori', '/models/Hiyori/Hiyori.model3.json') ON CONFLICT(id) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m01', 'hiyori', 'Hiyori_m01', 'Hiyori 待机动作 1') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m02', 'hiyori', 'Hiyori_m02', 'Hiyori 待机动作 2') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m03', 'hiyori', 'Hiyori_m03', 'Hiyori 待机动作 3') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m05', 'hiyori', 'Hiyori_m05', 'Hiyori 待机动作 5') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m06', 'hiyori', 'Hiyori_m06', 'Hiyori 待机动作 6') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m07', 'hiyori', 'Hiyori_m07', 'Hiyori 待机动作 7') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m08', 'hiyori', 'Hiyori_m08', 'Hiyori 待机动作 8') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m09', 'hiyori', 'Hiyori_m09', 'Hiyori 待机动作 9') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m10', 'hiyori', 'Hiyori_m10', 'Hiyori 待机动作 10') ON CONFLICT(model_id, name) DO NOTHING;
INSERT INTO live2d_motions (id, model_id, name, description) VALUES ('hiyori:Hiyori_m04', 'hiyori', 'Hiyori_m04', 'Hiyori 身体触碰反应动作，具体手势待确认。') ON CONFLICT(model_id, name) DO NOTHING;
COMMIT;
