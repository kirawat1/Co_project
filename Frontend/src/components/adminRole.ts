import { createContext, useContext } from "react";

// บทบาทในหน้าจัดการ (/admin): เจ้าหน้าที่ หรือ อาจารย์ประจำวิชา (majors = หลักสูตรที่ดูแล)
// ค่าเริ่มต้น = ไม่ใช่เจ้าหน้าที่ — หน้าเดียวกันที่ถูก mount ในแอปอาจารย์จะซ่อนงานของเจ้าหน้าที่ไว้ก่อนเสมอ
export interface AdminRole { isStaff: boolean; majors: string[] }

export const AdminRoleContext = createContext<AdminRole>({ isStaff: false, majors: [] });
export const useAdminRole = () => useContext(AdminRoleContext);
