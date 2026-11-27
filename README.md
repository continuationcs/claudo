# claudo

一个 Claude Code mod：在本地读 txt 文件，把内容作为注释夹在当前项目的真实代码里，显示在对话中 Bash 和 Read 工具行的下面。文件内容只在本机读取和绘制，不会发给模型，也不会写进对话记录。

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

都在对话里完成，没有单独的面板。在消息框里发送：

| 发送 | 作用 | 回答 |
| --- | --- | --- |
| `/claudo ~/Downloads/book.txt` | 打开这个 txt（UTF-8、GBK/GB18030 都能读） | `Ready.` |
| `/claudo` | 查看阅读进度 | `12.3%`（关着时末尾有 `· off`） |
| `/claudo off` / `/claudo on` | 停止 / 恢复在工具行下面显示 | `Off.` / `On.` |
| `/claudo n` / `/claudo b` | 下一页 / 上一页（命令行里只能这样翻） | 进度，如 `12.6%` |
| `x` | 老板键：立即隐藏所有内容，再发一次恢复 | 无 |

- `x` 会被拦下，不发给模型，也不进对话记录。
- `/claudo` 在桌面端会留在对话记录里，模型也能看到这一行和它的回答，所以回答里从不出现文件名；mod 还会把记录里命令后面的参数去掉，只留 `/claudo`。
- `/claudo` 在 Claude 回复的过程中也能直接用，不用等这一轮结束。

之后每个 Bash 和 Read 工具行下面多一行淡色的 `⎿ N matches …`：

- 点这行：展开 / 收起带注释的代码。同一时间只展开一个，展开另一行会收起前一行。
- 展开后点代码下面的 `… +N lines`：翻到下一页；点旁边的 `(ctrl+o to expand)`：翻回上一页。
- 只有一个阅读位置：不管展开哪一行，显示的都是你读到的那一页。进度只在翻页时移动，并自动保存。
- 代码块高度固定，每行都不会折行，翻页时按钮位置不动；一句话的几行注释总是连在一起。

**命令行（终端里的 `claude`）**：终端不会把点击交给 mod，所以最新的那个工具行会自动展开，用 `/claudo n` / `/claudo b` 翻页。

代码片段取自当前会话所在的 git 仓库；不在仓库里时取当前文件夹下的源码文件，都没有时用内置的一小段代码。

## 要求

需要支持 mod（hooks 模块）的 Claude Code 版本。GBK 转码用系统的 `iconv`，适用于 macOS 和 Linux。
