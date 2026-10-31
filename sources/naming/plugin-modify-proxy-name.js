function onSubscribe(proxies) {
  const remove = enabled(configuration.EnableRemoveKeywords, false) && configuration.RemoveKeywords
    ? new RegExp(String(configuration.RemoveKeywords), 'g') : null;
  const mode = String(configuration.EnableIndexProxyName == null ? '0' : configuration.EnableIndexProxyName);
  if (!['0', '1', '2'].includes(mode)) throw new Error('EnableIndexProxyName must be 0, 1 or 2');
  return renameNodes(proxies, function (name, index) {
    const match = identifyRegion(name);
    if (remove) name = name.replace(remove, '').trim();
    if (enabled(configuration.EnableAddEmoji, true)) name = withFlag(name, match);
    if (mode === '1') {
      const suffix = ' ' + (index + 1);
      if (!name.endsWith(suffix)) name += suffix;
    }
    return name;
  }, mode !== '0');
}
