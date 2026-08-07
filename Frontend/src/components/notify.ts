import type { StudentNotification } from "./store";

const LS_NOTIFY = "coop.student.notifications.v1";

function loadAll(): StudentNotification[] {
  try {
    return JSON.parse(localStorage.getItem(LS_NOTIFY) || "[]");
  } catch {
    localStorage.removeItem(LS_NOTIFY);
    return [];
  }
}

export function pushNotify(n: StudentNotification) {
  const list = loadAll();
  list.unshift(n);
  localStorage.setItem(LS_NOTIFY, JSON.stringify(list));
}

export function loadNotify(studentId: string) {
  return loadAll().filter((n) => n.studentId === studentId);
}
