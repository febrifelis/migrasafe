-- 004: Sequence and schema operations

-- CASE 1: CREATE SEQUENCE — safe (new object)
CREATE SEQUENCE shipment_batch_seq START 1 INCREMENT 1;

-- CASE 2: ALTER SEQUENCE RESTART WITH safe value — should flag regardless
--         (MigraSafe can't know if value is safe without reading MAX(id))
ALTER SEQUENCE shipments_id_seq RESTART WITH 1000000;

-- CASE 3: ALTER SEQUENCE SET CACHE — safe tuning
ALTER SEQUENCE shipments_id_seq CACHE 100;

-- CASE 4: DROP SCHEMA CASCADE — destroys everything in schema
DROP SCHEMA IF EXISTS legacy CASCADE;

-- CASE 5: CREATE SCHEMA — safe (new object)
CREATE SCHEMA logistics_v2;

-- CASE 6: RENAME TABLE — breaks all references (regression)
ALTER TABLE shipments RENAME TO shipments_v1;
