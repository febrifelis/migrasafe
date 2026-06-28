-- Stress test: full constraint matrix
-- Every ADD CONSTRAINT variant → correct severity

-- HIGH: ADD PRIMARY KEY (no USING INDEX)
ALTER TABLE orders ADD PRIMARY KEY (id);

-- SAFE: ADD PRIMARY KEY USING INDEX (pre-built)
CREATE UNIQUE INDEX CONCURRENTLY idx_orders_id2 ON orders(id);
ALTER TABLE orders ADD CONSTRAINT pk2 PRIMARY KEY USING INDEX idx_orders_id2;

-- HIGH: ADD FOREIGN KEY (no NOT VALID)
ALTER TABLE orders ADD FOREIGN KEY (customer_id) REFERENCES customers(id);

-- SAFE: ADD FOREIGN KEY NOT VALID (deferred scan)
ALTER TABLE orders
    ADD CONSTRAINT fk_customer FOREIGN KEY (customer_id)
    REFERENCES customers(id) NOT VALID;

-- HIGH: ADD UNIQUE (scans all rows)
ALTER TABLE orders ADD UNIQUE (ref);

-- HIGH: ADD CONSTRAINT UNIQUE (named)
ALTER TABLE orders ADD CONSTRAINT uq_orders_ref UNIQUE (ref);

-- MEDIUM: ADD CHECK (scans rows)
ALTER TABLE orders ADD CHECK (amount > 0);

-- MEDIUM: ADD CONSTRAINT CHECK (named)
ALTER TABLE orders ADD CONSTRAINT chk_amount CHECK (amount > 0);

-- SAFE: ADD CONSTRAINT CHECK NOT VALID (deferred scan)
ALTER TABLE orders
    ADD CONSTRAINT chk_amount2 CHECK (amount >= 0) NOT VALID;

-- MEDIUM: DROP CONSTRAINT (removes integrity guarantee)
ALTER TABLE orders DROP CONSTRAINT fk_old_customer;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS uq_old_ref;

-- SAFE: VALIDATE CONSTRAINT (ShareUpdateExclusiveLock only)
ALTER TABLE orders VALIDATE CONSTRAINT fk_customer;
ALTER TABLE orders VALIDATE CONSTRAINT chk_amount2;
