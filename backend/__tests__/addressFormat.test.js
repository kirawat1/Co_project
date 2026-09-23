// __tests__/addressFormat.test.js — ที่อยู่แบบแยกช่อง (ใบสมัคร T000 และแบบฟอร์ม T002)
const { composeAddress, hasAddressParts, pickAddressParts, buildAddressData } = require('../utils/addressFormat');

describe('ประกอบที่อยู่เป็นบรรทัดเดียว', () => {
  test('ต่างจังหวัดใช้ ต./อ./จ.', () => {
    expect(composeAddress({
      addrNo: '123/45', moo: '3', soi: 'ร่วมใจ', road: 'มิตรภาพ',
      subDistrict: 'ในเมือง', district: 'เมืองขอนแก่น', province: 'ขอนแก่น', zipcode: '40000',
    })).toBe('123/45 หมู่ 3 ซอยร่วมใจ ถนนมิตรภาพ ต.ในเมือง อ.เมืองขอนแก่น จ.ขอนแก่น 40000');
  });

  test('กรุงเทพฯ ใช้ แขวง/เขต และไม่เติม จ.', () => {
    expect(composeAddress({
      addrNo: '9', road: 'สุขุมวิท', subDistrict: 'คลองเตย', district: 'คลองเตย',
      province: 'กรุงเทพมหานคร', zipcode: '10110',
    })).toBe('9 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110');
  });

  test('ช่องที่ไม่ได้กรอกไม่ทิ้งช่องว่างค้าง', () => {
    expect(composeAddress({ addrNo: '1', subDistrict: 'ศิลา', district: 'เมือง', province: 'ขอนแก่น', zipcode: '40000' }))
      .toBe('1 ต.ศิลา อ.เมือง จ.ขอนแก่น 40000');
    expect(composeAddress({})).toBe('');
    expect(composeAddress({ addrNo: '  ', moo: null })).toBe('');
  });

  test('hasAddressParts บอกได้ว่ากรอกช่องย่อยมาหรือยัง', () => {
    expect(hasAddressParts({ province: 'ขอนแก่น' })).toBe(true);
    expect(hasAddressParts({ addrNo: '', moo: '   ' })).toBe(false);
    expect(hasAddressParts({})).toBe(false);
  });
});

describe('อ่านช่องย่อยจาก body', () => {
  test('ใช้ prefix เติมหน้าชื่อช่อง', () => {
    const parts = pickAddressParts({ contactAddrNo: '1', contactSubDistrict: 'ศิลา', emerAddrNo: '9' }, 'contact');
    expect(parts.addrNo).toBe('1');
    expect(parts.subDistrict).toBe('ศิลา');
    expect(parts.province).toBeUndefined(); // ไม่ได้ส่งมา = ไม่แตะของเดิม
  });
});

describe('เตรียมข้อมูลลงฐานข้อมูล', () => {
  test('กรอกช่องย่อย → ได้ทั้งช่องย่อยและข้อความรวมที่ประกอบใหม่', () => {
    const data = buildAddressData({
      contactAddrNo: '123', contactMoo: '3', contactSoi: '', contactRoad: '',
      contactSubDistrict: 'ในเมือง', contactDistrict: 'เมือง', contactProvince: 'ขอนแก่น', contactZipcode: '40000',
      contactAddress: 'ค่าเก่าที่ควรถูกทับ',
    }, 'contact', 'contactAddress');

    expect(data.contactAddrNo).toBe('123');
    expect(data.contactSoi).toBeNull();
    expect(data.contactAddress).toBe('123 หมู่ 3 ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000');
  });

  test('ไม่ได้ส่งช่องย่อยมาเลย → ใช้ข้อความรวมเดิม (ข้อมูลเก่ายังบันทึกได้)', () => {
    const data = buildAddressData({ contactAddress: '99 หมู่บ้านเดิม' }, 'contact', 'contactAddress');
    expect(data.contactAddress).toBe('99 หมู่บ้านเดิม');
    expect(data.contactAddrNo).toBeUndefined();
  });

  test('ส่งช่องย่อยมาแต่ว่างทั้งหมด = ล้างที่อยู่', () => {
    const data = buildAddressData({
      emerAddrNo: '', emerMoo: '', emerSoi: '', emerRoad: '',
      emerSubDistrict: '', emerDistrict: '', emerProvince: '', emerZipcode: '',
    }, 'emer', 'emergencyAddress');
    expect(data.emergencyAddress).toBe('');
    expect(data.emerAddrNo).toBeNull();
  });

  test('ที่อยู่คนละชุดในฟอร์มเดียวกันไม่ปนกัน', () => {
    const body = {
      accomAddrNo: '1', accomProvince: 'ขอนแก่น', accomSubDistrict: 'ศิลา', accomDistrict: 'เมือง', accomZipcode: '40000',
      emerAddrNo: '9', emerProvince: 'เลย', emerSubDistrict: 'กุดป่อง', emerDistrict: 'เมือง', emerZipcode: '42000',
    };
    const accom = buildAddressData(body, 'accom', 'accommodationAddress');
    const emer = buildAddressData(body, 'emer', 'emergencyAddress');
    expect(accom.accommodationAddress).toContain('จ.ขอนแก่น');
    expect(emer.emergencyAddress).toContain('จ.เลย');
    expect(accom.accomAddrNo).toBe('1');
    expect(emer.emerAddrNo).toBe('9');
  });
});
