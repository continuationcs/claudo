# claudo

一个 Claude Code mod：在本地读 txt 文件，显示成会话里的普通输出（回复、Read / Update / Bash 行），中间夹着当前项目里的真实代码。文件内容只在本机读取和绘制，不会发给模型，也不会写进对话记录。

## 安装

在终端的 Claude Code 会话里：

```
/plugin install claudo --marketplace continuationcs/claudo
```

或在 shell 里：

```bash
claude plugin install claudo --marketplace continuationcs/claudo
```

桌面端里 `/plugin` 不可用：点输入框旁边的 +，选 Plugins，Add marketplace 填 `continuationcs/claudo`，再 Add plugin。

这是私有仓库：只有能在 GitHub 上读这个仓库、并且本机已有 github.com 的 git 凭据（SSH key，或 `gh auth login` 后再 `gh auth setup-git`）的人才能安装。

## 用法

- `/claudo` 打开 Trace 面板，在输入框里填 txt 路径（如 `~/Downloads/book.txt`），点 Attach。UTF-8、GBK/GB18030 都能读。
- 面板里点 `‹` `›` 翻页，进度自动保存，下次打开接着读。
- 内嵌模式（默认开启，面板里的 `⇡` / `⇣` 开关）：每个 Bash 和 Read 工具行下面多一行淡色的 `⎿ N matches …`，点一下展开带注释的代码，再点一下收起。
- 老板键：在消息框里只发一个 `x`，所有内容立即隐藏；再发一次恢复。这条消息会被拦下，不会发给模型。

代码片段取自当前会话所在的 git 仓库；不在仓库里时取当前文件夹下的源码文件，都没有时用内置的一小段代码。

## 要求

需要支持 mod（hooks 模块）的 Claude Code 版本。GBK 转码用系统的 `iconv`，适用于 macOS 和 Linux。
