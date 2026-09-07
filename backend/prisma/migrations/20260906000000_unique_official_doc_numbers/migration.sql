-- เลขที่หนังสือราชการห้ามซ้ำ (NULL ซ้ำได้ตามพฤติกรรม unique index ของ MySQL)
-- ล้างค่าเทมเพลตที่ยังไม่ได้กรอก (จุดไข่ปลา / xxxx / ค่าว่าง) ให้เป็น NULL ก่อน
UPDATE `StudentCoop` SET `reqDocNumber` = NULL
  WHERE `reqDocNumber` REGEXP '[.]{3,}' OR `reqDocNumber` REGEXP 'x{3,}' OR `reqDocNumber` = '';
UPDATE `StudentCoop` SET `placeDocNumber` = NULL
  WHERE `placeDocNumber` REGEXP '[.]{3,}' OR `placeDocNumber` REGEXP 'x{3,}' OR `placeDocNumber` = '';

-- CreateIndex
CREATE UNIQUE INDEX `StudentCoop_reqDocNumber_key` ON `StudentCoop`(`reqDocNumber`);
CREATE UNIQUE INDEX `StudentCoop_placeDocNumber_key` ON `StudentCoop`(`placeDocNumber`);
