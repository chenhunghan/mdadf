IDN links exercise markdown-it's URL normalization, which is where scriptc
shims node:punycode.

[unicode host](https://日本語.jp/path)

[cyrillic host](https://пример.рф/страница)

[german umlaut](https://münchen.de/straße)

[already punycode](https://xn--wgv71a119e.jp/path)

[percent encoded path](https://example.com/%E6%97%A5%E6%9C%AC%E8%AA%9E)

[query with unicode](https://example.com/search?q=日本語&lang=ja)

[fragment with unicode](https://example.com/page#セクション)

[port and auth](https://example.com:8443/path)

[![idn image](https://画像.jp/img.png)](https://日本語.jp)
