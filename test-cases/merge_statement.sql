MERGE INTO inventory AS target
USING staging AS source ON target.product_id = source.product_id
WHEN MATCHED THEN
  UPDATE SET quantity = source.quantity, updated_at = now()
WHEN NOT MATCHED THEN
  INSERT (product_id, quantity) VALUES (source.product_id, source.quantity);
