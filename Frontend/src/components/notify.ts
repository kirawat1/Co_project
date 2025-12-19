import type { StudentNotification } from "./store";

const LS_NOTIFY = "coop.student.notifications.v1";

export function pushNotify(n: StudentNotification) {
  const list: StudentNotification[] =
    JSON.parse(localStorage.getItem(LS_NOTIFY) || "[]");
  list.unshift(n);
  localStorage.setItem(LS_NOTIFY, JSON.stringify(list));
}

export function loadNotify(studentId: string) {
  const list: StudentNotification[] =
    JSON.parse(localStorage.getItem(LS_NOTIFY) || "[]");
  return list.filter((n) => n.studentId === studentId);
}
