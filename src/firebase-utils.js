
export function parseDoc(doc) {
  const item = doc.data();
  item.id = doc.id;
  return item;
}

export function parseSnapshot(snapshot) {
  const items = [];
  snapshot.forEach((doc) => {
    const item = doc.data();
    item.id = doc.id;
    items.push(item);
  });
  return items;
}