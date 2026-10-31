function onSubscribe(proxies) {
  return renameNodes(proxies, function (name, index) {
    const suffix = '_' + (index + 1);
    return name.endsWith(suffix) ? name : name + suffix;
  });
}
