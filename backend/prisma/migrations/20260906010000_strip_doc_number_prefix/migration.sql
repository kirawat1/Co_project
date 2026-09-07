-- เลขที่หนังสือเก็บเป็นตัวเลขล้วน เช่น "660301.26.6.2/1234"
-- คำนำหน้า "ที่ อว" ถูกเติมในเทมเพลตหนังสือตอนสร้าง PDF/Word แล้ว
-- ถ้าปล่อยให้เก็บสองรูปแบบ เลขเดียวกันจะเลี่ยง unique index ได้ และเอกสารจะขึ้น "ที่ อว อว 660301..."
UPDATE `StudentCoop`
   SET `reqDocNumber` = TRIM(REGEXP_REPLACE(`reqDocNumber`, '^[[:space:]]*(ที่[[:space:]]*)?อว\.?[[:space:]]*', ''))
 WHERE `reqDocNumber` REGEXP '^[[:space:]]*(ที่[[:space:]]*)?อว';

UPDATE `StudentCoop`
   SET `placeDocNumber` = TRIM(REGEXP_REPLACE(`placeDocNumber`, '^[[:space:]]*(ที่[[:space:]]*)?อว\.?[[:space:]]*', ''))
 WHERE `placeDocNumber` REGEXP '^[[:space:]]*(ที่[[:space:]]*)?อว';
