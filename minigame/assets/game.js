/* assets 分包入口文件（纯资源分包，无运行逻辑）
   微信小游戏的分包与小程序不同：编译器要求每个「目录型分包」的根目录必须存在
   game.js 入口文件，缺失会直接报错：
     game.json: 未找到 ["subpackages"][0]["root"] 对应的 /assets/game.js 文件
   本目录只有图片 / 音频等静态资源，没有任何需要执行的代码，
   所以这里只留注释占位即可；wx.loadSubpackage({ name: "assets" })
   下载完成后本文件被"执行"（空操作），assets/ 下的资源随即可按
   相对包根目录的完整路径（如 "assets/mice/xxx.png"）访问。 */
