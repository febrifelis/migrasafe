ALTER TABLE orders DISABLE TRIGGER ALL;
UPDATE orders SET recalculated = true WHERE status = 'legacy';
ALTER TABLE orders ENABLE TRIGGER ALL;
