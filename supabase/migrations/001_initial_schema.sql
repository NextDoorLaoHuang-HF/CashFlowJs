-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  mode TEXT DEFAULT 'online' CHECK (mode IN ('online', 'local')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Room players (slot mapping)
CREATE TABLE room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  player_slot INT NOT NULL CHECK (player_slot >= 0 AND player_slot <= 5),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  scenario_id TEXT,
  dream_id TEXT,
  is_ready BOOLEAN DEFAULT false,
  is_connected BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, player_slot),
  UNIQUE(room_id, user_id)
);

-- Game states (one active record per room, large JSONB)
CREATE TABLE game_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  phase TEXT,
  turn_state TEXT,
  current_player_id TEXT,
  turn INT DEFAULT 0,
  players JSONB,
  decks JSONB,
  discard JSONB,
  selected_card JSONB,
  market_session JSONB,
  liquidation_session JSONB,
  dice JSONB,
  logs JSONB,
  replay_frames JSONB,
  ventures JSONB,
  loans JSONB,
  settings JSONB,
  history JSONB,
  charity_prompt JSONB,
  rng_seed INT,
  rng_state INT,
  version INT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id)
);

-- Action logs (for replay, reconnect, audit)
CREATE TABLE game_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL,
  payload JSONB,
  resulting_state_version INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_room_players_room_id ON room_players(room_id);
CREATE INDEX idx_room_players_user_id ON room_players(user_id);
CREATE INDEX idx_game_states_room_id ON game_states(room_id);
CREATE INDEX idx_game_actions_room_id ON game_actions(room_id);

-- Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
CREATE POLICY "rooms_select" ON rooms
  FOR SELECT USING (true);

CREATE POLICY "rooms_insert" ON rooms
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "rooms_update" ON rooms
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "rooms_delete" ON rooms
  FOR DELETE USING (auth.uid() = host_id);

-- RLS Policies for room_players
CREATE POLICY "room_players_select" ON room_players
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM room_players rp
      WHERE rp.room_id = room_players.room_id AND rp.user_id = auth.uid()
    )
  );

CREATE POLICY "room_players_insert" ON room_players
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "room_players_update" ON room_players
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "room_players_delete" ON room_players
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for game_states (readable by room members)
CREATE POLICY "game_states_select" ON game_states
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_players rp
      WHERE rp.room_id = game_states.room_id AND rp.user_id = auth.uid()
    )
  );

-- game_states insert/update/delete bypassed by Server Actions using service_role

-- RLS Policies for game_actions (readable by room members)
CREATE POLICY "game_actions_select" ON game_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_players rp
      WHERE rp.room_id = game_actions.room_id AND rp.user_id = auth.uid()
    )
  );

-- game_actions insert bypassed by Server Actions using service_role

-- Function to generate 6-character room code
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM rooms WHERE rooms.code = code) INTO exists_check;
    EXIT WHEN NOT exists_check;
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER game_states_updated_at
  BEFORE UPDATE ON game_states
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
