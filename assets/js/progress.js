const statusLabels = {
  todo: 'To do',
  current: 'Current',
  done: 'Done',
  skipped: 'Skipped',
};
function updateStudy(edit) {
  const p = getProgress();
  edit(p, new Date().toISOString());
  if (!saveProgress(p))
    throw Error('Progress could not be saved on this device.');
}
function assignmentState(p, id) {
  return p.playbook.assignments[id] || { status: 'todo', photos: {} };
}
function photosFor(p, id) {
  return Object.entries(assignmentState(p, id).photos || {}).filter(
    ([, photo]) => !photo.deleted
  );
}
function setAssignmentStatus(id, status) {
  if (!Object.hasOwn(statusLabels, status)) return;
  updateStudy((p, now) => {
    const all = p.playbook.assignments;
    if (status === 'current')
      for (const [key, other] of Object.entries(all)) {
        if (key !== id && other.status === 'current')
          Object.assign(other, {
            status: 'todo',
            statusAt: now,
            updatedAt: now,
            currentSince: null,
            doneAt: null,
          });
      }
    const a = assignmentState(p, id);
    all[id] = {
      ...a,
      status,
      statusAt: now,
      updatedAt: now,
      currentSince: status === 'current' ? a.currentSince || now : null,
      doneAt: status === 'done' ? a.doneAt || now : null,
    };
  });
}
function setSegmentRead(id, read) {
  updateStudy((p, updatedAt) => {
    p.onbeing.segments[id] = { read, updatedAt };
  });
}
function sortedSubjects(p) {
  return Object.entries(p.subjects)
    .filter(([, s]) => !s.deleted)
    .sort(
      ([, a], [, b]) =>
        Number(b.kind === 'project') - Number(a.kind === 'project') ||
        Number(b.starred) - Number(a.starred) ||
        b.createdAt.localeCompare(a.createdAt)
    );
}
function addSubject(text) {
  text = text.trim();
  if (!text || text.length > 200)
    throw Error('Enter a subject of 1–200 characters.');
  updateStudy((p, now) => {
    p.subjects[crypto.randomUUID()] = {
      text,
      starred: false,
      kind: 'interest',
      links: [],
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };
  });
}
