-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  bio TEXT,
  profile_image_url VARCHAR(255),
  roles TEXT[] DEFAULT '{"user"}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Datasets Table
CREATE TABLE datasets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  visibility VARCHAR(20) CHECK (visibility IN ('public', 'private', 'collaborative')) DEFAULT 'private',
  data_type VARCHAR(20) CHECK (data_type IN ('image', 'text', 'structured')) NOT NULL,
  current_version VARCHAR(20) DEFAULT '1.0.0',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dataset Versions Table
CREATE TABLE dataset_versions (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
  version VARCHAR(20) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dataset_id, version)
);

-- Contributions Table
CREATE TABLE contributions (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
  contributor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  content JSONB NOT NULL,
  metadata JSONB,
  validation_status VARCHAR(20) CHECK (validation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Validations Table
CREATE TABLE validations (
  id SERIAL PRIMARY KEY,
  contribution_id INTEGER REFERENCES contributions(id) ON DELETE CASCADE,
  validator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) CHECK (status IN ('approved', 'rejected')) NOT NULL,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dataset Collaborators Table
CREATE TABLE dataset_collaborators (
  dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('viewer', 'contributor', 'validator', 'admin')) DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (dataset_id, user_id)
);

-- Quality Metrics Table
CREATE TABLE quality_metrics (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
  metric_name VARCHAR(50) NOT NULL,
  metric_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tags Table
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

-- Dataset Tags Mapping
CREATE TABLE dataset_tags (
  dataset_id INTEGER REFERENCES datasets(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (dataset_id, tag_id)
);