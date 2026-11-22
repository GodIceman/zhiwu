import { ChevronDown, ExternalLink, MessageSquare, ShieldCheck } from 'lucide-react'
import { appVersion, downloadUrl, feedbackUrl } from '../lib/app-info'
import './AboutSettings.css'

export function AboutSettings() {
  return (
    <div className="settings-group about-settings">
      <div className="settings-group-heading">
        <h2>关于知物</h2>
        <span>v{appVersion}</span>
      </div>
      <div className="about-settings-rows">
        <details className="privacy-disclosure">
          <summary>
            <ShieldCheck size={18} />
            <span>数据与隐私</span>
            <ChevronDown size={17} className="privacy-chevron" />
          </summary>
          <div className="privacy-copy">
            <p>物品和服务记录保存在当前设备，知物不主动上传这些记录，也不需要注册账号。</p>
            <p>卸载应用、清理数据或更换设备前，请先导出 JSON 备份。备份包含你的个人记录，请妥善保管。</p>
            <p>服务期限需要打开应用查看，目前没有系统到期通知。</p>
            {feedbackUrl && <p>意见反馈会打开第三方表单，只有你主动填写并提交的内容会发送给表单平台及开发者，物品清单不会自动附带。</p>}
          </div>
        </details>
        {feedbackUrl && (
          <a className="about-settings-link" href={feedbackUrl} target="_blank" rel="noopener noreferrer">
            <MessageSquare size={18} /><span>意见反馈</span><ExternalLink size={16} />
          </a>
        )}
        {downloadUrl && (
          <a className="about-settings-link" href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={18} /><span>获取新版</span><ExternalLink size={16} />
          </a>
        )}
      </div>
    </div>
  )
}
