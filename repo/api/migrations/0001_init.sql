-- Homes, members, bills and shares. STRICT tables reject values of the wrong type
-- (for example the text '1000' in an INTEGER column), so the database is a second
-- line of defence behind request validation.

CREATE TABLE homes (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT pk_homes PRIMARY KEY (id),
  CONSTRAINT ck_homes_name_length CHECK (length(trim(name)) BETWEEN 1 AND 100)
) STRICT;

CREATE TABLE members (
  id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  CONSTRAINT pk_members PRIMARY KEY (id),
  CONSTRAINT fk_members_home FOREIGN KEY (home_id) REFERENCES homes (id),
  CONSTRAINT uq_members_home_position UNIQUE (home_id, position),
  CONSTRAINT ck_members_name_length CHECK (length(trim(name)) BETWEEN 1 AND 100),
  CONSTRAINT ck_members_position_positive CHECK (position >= 1)
) STRICT;

CREATE TABLE bills (
  id TEXT NOT NULL,
  home_id TEXT NOT NULL,
  title TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT pk_bills PRIMARY KEY (id),
  CONSTRAINT fk_bills_home FOREIGN KEY (home_id) REFERENCES homes (id),
  CONSTRAINT ck_bills_total_positive CHECK (total_cents > 0),
  CONSTRAINT ck_bills_title_length CHECK (length(trim(title)) BETWEEN 1 AND 200)
) STRICT;

CREATE TABLE shares (
  id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  paid_at TEXT,
  idempotency_key TEXT,
  CONSTRAINT pk_shares PRIMARY KEY (id),
  CONSTRAINT fk_shares_bill FOREIGN KEY (bill_id) REFERENCES bills (id),
  CONSTRAINT fk_shares_member FOREIGN KEY (member_id) REFERENCES members (id),
  CONSTRAINT uq_shares_bill_member UNIQUE (bill_id, member_id),
  CONSTRAINT ck_shares_amount_non_negative CHECK (amount_cents >= 0),
  CONSTRAINT ck_shares_paid_consistent CHECK ((paid_at IS NULL) = (idempotency_key IS NULL))
) STRICT;

CREATE INDEX idx_bills_home ON bills (home_id);
CREATE INDEX idx_shares_member_unpaid ON shares (member_id) WHERE paid_at IS NULL;
