INSERT INTO users (id, name) VALUES (1, 'owner')
ON CONFLICT(id) DO NOTHING;
