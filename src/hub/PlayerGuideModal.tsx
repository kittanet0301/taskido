import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ELEMENT_IDS, PURE_CHANCE } from '../shared/elements'

interface Props {
  onClose: () => void
}

const GUIDE_SECTIONS = [
  { id: 'howto', num: '01', title: 'วิธีการเล่น' },
  { id: 'species', num: '02', title: 'สายพันธุ์ & ธาตุ' },
  { id: 'activity', num: '03', title: 'Activity Score & การเติบโต' },
  { id: 'care', num: '04', title: 'การดูแล & ไอเทม' },
  { id: 'rpgstat', num: '05', title: 'ค่าพลัง RPG' },
  { id: 'growth', num: '06', title: 'เลเวล, Growth Cards & สกิล' },
  { id: 'battle', num: '07', title: 'การต่อสู้' },
  { id: 'breed', num: '08', title: 'ผสมพันธุ์' },
  { id: 'economy', num: '09', title: 'ภารกิจ & เศรษฐกิจ' },
  { id: 'more', num: '10', title: 'มินิเกม & สังคม' }
] as const

const GUIDE_SECTION_IDS = GUIDE_SECTIONS.map((section) => section.id)
const GUIDE_SCROLL_ANCHOR_PX = 96

const ELEMENT_SWATCH: Record<(typeof ELEMENT_IDS)[number], string> = {
  neutral: '#a9a38f',
  fire: '#e85d3f',
  grass: '#55a85b',
  ground: '#9a724e',
  electric: '#f2cf42',
  water: '#3d8ed0',
  ice: '#82d6e8',
  dragon: '#f0940f',
  dark: '#4b405f'
}

const CARE_ITEMS: Array<{ name: string; effect: string }> = [
  { name: '🍚 food_basic', effect: '+15 Feed' },
  { name: '🍱 food_premium', effect: '+30 Feed, +10 Heal' },
  { name: '💊 medicine', effect: '+40 Heal' },
  { name: '💧 water', effect: '+10 Feed, +5 Heal' },
  { name: '🧸 toy', effect: '+25 Feed (ผลต่อ Emotion)' },
  { name: '🧪 dev_vitamin', effect: '+50 Evolution' },
  { name: '🛡 battle_shield', effect: 'ป้องกันพิเศษระหว่างต่อสู้' },
  { name: '🪺 breed_nest', effect: 'ใช้เริ่มการผสมพันธุ์' },
  { name: '🌀 skill_forget', effect: 'รีเซ็ตสกิลที่เลือกไว้' }
]

const GROWTH_CARDS: Array<{ icon: string; name: string; desc: string }> = [
  { icon: '💪', name: 'power_up', desc: 'เน้นสายโจมตี' },
  { icon: '💨', name: 'swift', desc: 'เน้นสายเร็ว/หลบ' },
  { icon: '🎯', name: 'focus', desc: 'เน้นสายเวท/แม่นยำ' },
  { icon: '🛡️', name: 'tough', desc: 'เน้นสายทนทาน' },
  { icon: '🥊', name: 'bruiser', desc: 'โจมตี + ทนทาน ผสมกัน' },
  { icon: '🔮', name: 'magelet', desc: 'เวทเบา ๆ เสริม INT' },
  { icon: '⚖️', name: 'all_round', desc: 'บาลานซ์ทุกด้าน' }
]

const PLAY_STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'สมัคร / เข้าสู่ระบบ',
    body: 'ก่อนล็อกอิน คุณจะเห็นแค่ไข่บนหน้าจอ ยังไม่มีสถิติใด ๆ ให้ดู — ล็อกอินเพื่อโหลดสัตว์เลี้ยงจริงจากคลาวด์'
  },
  {
    title: 'สะสม Activity จากการใช้คอมพิวเตอร์',
    body: 'หลังล็อกอิน (บน Desktop) ระบบจะนับคลิกเมาส์และการพิมพ์ทั้งเครื่อง แล้วแปลงเป็นความก้าวหน้าของไข่'
  },
  {
    title: 'ฟักไข่',
    body: 'เมื่อสะสมพอ ไข่จะฟักออกมาเป็น 1 ใน 9 สายพันธุ์แบบสุ่ม พร้อมเพศ (ตัวผู้/ตัวเมีย) และธาตุประจำตัว'
  },
  {
    title: 'ดูแล Health / Emotion / Evolution',
    body: 'ให้อาหาร รักษา และเล่นกับสัตว์เลี้ยงผ่านไอเทมและ Quick-care slots เพื่อรักษาสถานะและเร่งวิวัฒนาการ Egg → Baby → Adult'
  },
  {
    title: 'เก็บเลเวล RPG',
    body: 'เลเวลอัพเพื่อเลือก Growth Card และอัปแรงค์สกิล สร้างสไตล์การเล่นของสัตว์แต่ละตัว'
  },
  {
    title: 'ต่อสู้ PvP แบบ Async',
    body: 'สร้างหรือเข้าห้องต่อสู้ด้วยรหัส ดวล 1v1 หรือฝึกกับ Bot ก่อนก็ได้'
  },
  {
    title: 'ทำภารกิจ ซื้อของ ผสมพันธุ์',
    body: 'Daily/Weekly Missions ให้ Gems ไว้ซื้อของใน Market เก็บ Breed Nest ไว้ผสมพันธุ์สร้างไข่ใบใหม่'
  },
  {
    title: 'เล่นมินิเกมและเข้าสังคม',
    body: 'Dino Jump / Rock Dodge แข่งอันดับ พร้อมระบบเพื่อน แชท และของขวัญ'
  }
]

function ChapterHead({ num, title }: { num: string; title: string }) {
  return (
    <div className="guide-chapter-head">
      <span className="guide-chapter-num">{num}</span>
      <h3 className="guide-chapter-title">{title}</h3>
    </div>
  )
}

export function PlayerGuideModal({ onClose }: Props) {
  const { t } = useTranslation()
  const contentRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [activeSection, setActiveSection] = useState<string>('howto')
  const purePct = Math.round(PURE_CHANCE * 100)
  const dualPct = 100 - purePct

  useEffect(() => {
    const root = contentRef.current
    if (!root) return

    const syncActiveSection = () => {
      const rootTop = root.getBoundingClientRect().top
      let current = GUIDE_SECTION_IDS[0]
      const nearBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 12

      if (nearBottom) {
        current = GUIDE_SECTION_IDS[GUIDE_SECTION_IDS.length - 1]
      } else {
        for (const id of GUIDE_SECTION_IDS) {
          const el = root.querySelector<HTMLElement>(`#guide-${id}`)
          if (!el) continue
          if (el.getBoundingClientRect().top - rootTop <= GUIDE_SCROLL_ANCHOR_PX) {
            current = id
          }
        }
      }

      setActiveSection(current)
    }

    syncActiveSection()
    root.addEventListener('scroll', syncActiveSection, { passive: true })
    return () => root.removeEventListener('scroll', syncActiveSection)
  }, [])

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    nav.querySelector<HTMLElement>('.guide-nav-link--active')?.scrollIntoView({ block: 'nearest' })
  }, [activeSection])

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id)
    const root = contentRef.current
    if (!root) return
    const target = root.querySelector<HTMLElement>(`#guide-${id}`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="hub-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="hub-modal hub-modal--lg guide-modal card"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="player-guide-title"
      >
        <div className="hub-modal-head guide-modal-head">
          <h2 id="player-guide-title">{t('guide.title')}</h2>
          <button type="button" className="hub-modal-close" onClick={onClose} aria-label={t('common.cancel')}>
            ×
          </button>
        </div>

        <div className="guide-modal-body">
          <nav ref={navRef} className="guide-nav" aria-label={t('guide.navLabel')}>
            <ul className="guide-nav-list">
              {GUIDE_SECTIONS.map((section) => (
                <li key={section.id}>
                  <button
                    type="button"
                    className={`guide-nav-link${activeSection === section.id ? ' guide-nav-link--active' : ''}`}
                    onClick={() => scrollToSection(section.id)}
                  >
                    <span className="guide-nav-idx">{section.num}</span>
                    {section.title}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div ref={contentRef} className="guide-content">
            <section id="guide-howto" className="guide-section">
              <div className="guide-hero card">
                <p className="guide-hero-kicker">{t('guide.subtitle')}</p>
                <h3 className="guide-hero-title">{t('common.appName')}</h3>
                <p className="guide-hero-sub">
                  เกมเลี้ยงไดโนเสาร์ธาตุแบบ Tamagotchi — ฟักไข่ ดูแล เก็บเลเวล ต่อสู้ PvP และผสมพันธุ์
                  ทุกอย่างขับเคลื่อนด้วยการใช้คอมพิวเตอร์จริงของคุณ
                </p>
                <div className="guide-tagbar">
                  <span className="guide-tag">🥚 9 สายพันธุ์</span>
                  <span className="guide-tag">⚔️ Async PvP</span>
                  <span className="guide-tag">🌱 Breeding</span>
                  <span className="guide-tag">🖥 Desktop + 🌐 Web</span>
                </div>

                <ChapterHead num="01" title="วิธีการเล่นเกม" />
                <ol className="guide-steps">
                  {PLAY_STEPS.map((step, index) => (
                    <li key={step.title} className="guide-step">
                      <span className="guide-step-num">{index + 1}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            <section id="guide-species" className="guide-section">
              <ChapterHead num="02" title="สายพันธุ์ & ธาตุ" />
              <p className="guide-intro">
                Taskino มีสัตว์ 9 สายพันธุ์ แต่ละตัวผูกกับธาตุประจำตัวหนึ่งธาตุ (หรือสองธาตุถ้าเปิดระบบ dual)
                สุ่มได้ตอนฟักไข่
              </p>
              <div className="guide-species-grid">
                {ELEMENT_IDS.map((id) => (
                  <div key={id} className="guide-species-chip">
                    <span className="guide-swatch" style={{ background: ELEMENT_SWATCH[id] }} />
                    <div>
                      <div className="guide-species-name">{id}</div>
                      <div className="guide-species-hex">{ELEMENT_SWATCH[id]}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="card guide-panel">
                <h4>🎲 โอกาสได้ธาตุตอนฟักไข่</h4>
                <div className="guide-prob-bar">
                  <div className="guide-prob-pure" style={{ width: `${purePct}%` }}>
                    Pure {purePct}%
                  </div>
                  <div className="guide-prob-dual" style={{ width: `${dualPct}%` }}>
                    Dual {dualPct}%
                  </div>
                </div>
                <p className="guide-note">
                  Pure = ธาตุเดียว, Dual = สองธาตุผสม (ปัจจุบันระบบ Dual ปิดชั่วคราว สัตว์ทุกตัวจึงออกเป็น Pure
                  element)
                </p>
              </div>
            </section>

            <section id="guide-activity" className="guide-section">
              <ChapterHead num="03" title="Activity Score & การเติบโต" />
              <p className="guide-intro">
                หัวใจของ Taskino คือการแปลงการใช้คอมพิวเตอร์จริงให้กลายเป็นค่า Evolution ที่ทำให้สัตว์เลี้ยงเติบโต
              </p>
              <div className="card guide-panel">
                <h4>🧮 สูตรคำนวณ Activity Score</h4>
                <div className="guide-formula">
                  Activity Score = จำนวนคลิก + floor( จำนวนปุ่มที่กด ÷ 10 )
                </div>
                <p className="guide-note">
                  พูดง่าย ๆ: คลิก 1 ครั้ง = 1 คะแนนเต็ม ๆ ส่วนการพิมพ์ต้องกดครบทุก 10 ตัวอักษรถึงจะได้ 1 คะแนน —
                  ระบบปัดเศษลง (floor) เสมอ เช่น พิมพ์ 24 ตัวอักษร = ได้แค่ 2 คะแนนจากการพิมพ์ ไม่ใช่ 2.4
                </p>
              </div>
              <div className="guide-grid guide-grid-3">
                <div className="card guide-panel">
                  <h4>❤️ Health</h4>
                  <p>สุขภาพของสัตว์เลี้ยง ค่อย ๆ ลดลงถ้าไม่ได้กลับมาดูแล ต้องเติมด้วยไอเทมอาหาร/ยา</p>
                </div>
                <div className="card guide-panel">
                  <h4>🙂 Emotion</h4>
                  <p>อารมณ์ของสัตว์เลี้ยง ลดลงตามเวลาเช่นกัน เติมได้ด้วยของเล่นและการเล่นด้วยกัน</p>
                </div>
                <div className="card guide-panel">
                  <h4>✨ Evolution</h4>
                  <p>
                    สะสมจาก Activity Score (คลิก/พิมพ์) โดยตรง และเติมเพิ่มได้ด้วยไอเทม{' '}
                    <code>dev_vitamin</code> (+50 ต่อครั้ง)
                  </p>
                </div>
              </div>
              <div className="card guide-panel">
                <h4>🐣 3 ระยะการเติบโต</h4>
                <div className="guide-stage-strip">
                  <div className="guide-stage-node">
                    <div className="guide-stage-sprite guide-stage-egg">🥚</div>
                    <div className="guide-stage-label">Egg</div>
                    <div className="guide-stage-size">แสดงผล 250px</div>
                  </div>
                  <div className="guide-stage-arrow" />
                  <div className="guide-stage-node">
                    <div className="guide-stage-sprite guide-stage-baby">🐣</div>
                    <div className="guide-stage-label">Baby</div>
                    <div className="guide-stage-size">แสดงผล 250px</div>
                  </div>
                  <div className="guide-stage-arrow" />
                  <div className="guide-stage-node">
                    <div className="guide-stage-sprite guide-stage-adult">🐉</div>
                    <div className="guide-stage-label">Adult</div>
                    <div className="guide-stage-size">แสดงผล 500px</div>
                  </div>
                </div>
                <p className="guide-note">
                  เมื่อค่า Evolution สะสมถึงเกณฑ์ สัตว์จะขยับระยะถัดไปทันที — Egg มีแอนิเมชันแค่ move และ hatch ส่วน
                  Baby กับ Adult จะปลดล็อกครบชุด idle / move / hurt / bite / jump และตัว Adult จะขยายขนาดแสดงผลเป็นสองเท่า
                </p>
              </div>
            </section>

            <section id="guide-care" className="guide-section">
              <ChapterHead num="04" title="การดูแล & การคำนวณไอเทม" />
              <p className="guide-intro">
                ทุกไอเทมมีผลเป็นตัวเลขตรง ๆ กับสถานะของสัตว์ — บวกเข้ากับค่าปัจจุบันทันทีที่ใช้
              </p>
              <div className="card guide-panel">
                <table className="guide-calc-table">
                  <thead>
                    <tr>
                      <th>ไอเทม</th>
                      <th>ผลลัพธ์เมื่อใช้</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CARE_ITEMS.map((item) => (
                      <tr key={item.name}>
                        <td className="guide-calc-name">{item.name}</td>
                        <td>{item.effect}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="guide-note">ใช้งานได้เร็วผ่าน Quick-care slots (4 ช่อง) โดยไม่ต้องเปิด Inventory เต็ม</p>
            </section>

            <section id="guide-rpgstat" className="guide-section">
              <ChapterHead num="05" title="ค่าพลัง RPG เข้าใจง่าย" />
              <p className="guide-intro">
                สัตว์แต่ละตัวมีค่าพื้นฐาน 4 ค่า กำหนดตามธาตุตั้งแต่ตอนฟักไข่ แล้วระบบจะแปลงเป็นค่าที่ใช้จริงในสนามรบ
              </p>
              <div className="guide-grid guide-grid-2">
                <div className="card guide-panel">
                  <h4>ค่าพื้นฐาน (Primary Stats)</h4>
                  <div className="guide-stat-grid">
                    <div className="guide-stat-core guide-stat-str">
                      <div className="guide-stat-letters">STR</div>
                      <div className="guide-stat-name">แรงโจมตี</div>
                    </div>
                    <div className="guide-stat-core guide-stat-dex">
                      <div className="guide-stat-letters">DEX</div>
                      <div className="guide-stat-name">ความเร็ว/หลบ</div>
                    </div>
                    <div className="guide-stat-core guide-stat-int">
                      <div className="guide-stat-letters">INT</div>
                      <div className="guide-stat-name">พลังเวท/MP</div>
                    </div>
                    <div className="guide-stat-core guide-stat-con">
                      <div className="guide-stat-letters">CON</div>
                      <div className="guide-stat-name">พลังชีวิต/ป้องกัน</div>
                    </div>
                  </div>
                </div>
                <div className="card guide-panel">
                  <h4>ค่าที่ใช้จริงในสนามรบ (Derived Stats)</h4>
                  <div className="guide-formula">
                    STR → ATK (พลังโจมตี)
                    <br />
                    CON → HP &amp; DEF (พลังชีวิต / ป้องกัน)
                    <br />
                    INT → MP (พลังสกิล)
                    <br />
                    DEX → EVA &amp; ลำดับเทิร์น
                  </div>
                </div>
              </div>
              <p className="guide-note">
                พูดง่าย ๆ คือ: ค่าพื้นฐาน 4 ตัวเป็นวัตถุดิบ ส่วนค่าต่อสู้ (HP/MP/ATK/DEF/EVA) คือผลลัพธ์ที่เกมคำนวณให้อัตโนมัติทุกครั้งที่เข้าสนามรบ
              </p>
            </section>

            <section id="guide-growth" className="guide-section">
              <ChapterHead num="06" title="เลเวล, Growth Cards & สกิล" />
              <p className="guide-intro">
                Evolution พาสัตว์ไปถึงระยะ Adult ส่วนเลเวลคือระบบเสริมพลังที่เดินหน้าต่อไปได้เรื่อย ๆ หลังจากนั้น —
                ทุกครั้งที่เลเวลอัพ ผู้เล่นจะได้รับ 2 อย่างพร้อมกัน
              </p>
              <div className="card guide-panel">
                <h4>🔁 วงจรเลเวลอัพ</h4>
                <div className="guide-loop-row">
                  <div className="guide-loop-box guide-loop-box--hi">เก็บเลเวล</div>
                  <span className="guide-loop-arrow">→</span>
                  <div className="guide-loop-box">
                    เลือก Growth Card
                    <br />1 จาก 3 ใบ
                  </div>
                  <span className="guide-loop-arrow">+</span>
                  <div className="guide-loop-box">
                    ได้ Skill Upgrade Point
                    <br />1 แต้ม
                  </div>
                </div>
              </div>
              <div className="card guide-panel">
                <h4>🎴 Growth Card ทั้ง 7 แบบ</h4>
                <p className="guide-note" style={{ marginTop: 0, marginBottom: 12 }}>
                  ทุกครั้งที่เลเวลอัพ ระบบสุ่มชู 3 ใบจากพูลนี้ให้เลือก 1 ใบ — ชื่อการ์ดบ่งบอกแนวทางการเสริมพลังคร่าว ๆ
                  ทำให้สัตว์ตัวเดียวกันเติบโตไปคนละแบบได้ในแต่ละรอบเล่น:
                </p>
                <div className="guide-grid guide-grid-3">
                  {GROWTH_CARDS.map((card) => (
                    <div key={card.name} className="guide-gcard">
                      <span className="guide-gcard-icon">{card.icon}</span>
                      <div className="guide-gcard-name">{card.name}</div>
                      <div className="guide-gcard-desc">{card.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card guide-panel">
                <h4>✦ สกิลและการอัปแรงค์</h4>
                <ul className="guide-spec-list">
                  <li>
                    สัตว์แต่ละตัวมีโหลดเอาต์ตายตัว 4 สกิล: <strong>3 สกิลปกติ + 1 Ultimate</strong> ที่สุ่มตามธาตุตั้งแต่ตอนฟักไข่
                  </li>
                  <li>Skill Upgrade Point ที่ได้จากการเลเวลอัพ ใช้อัปแรงค์สกิลใดก็ได้ในโหลดเอาต์ทีละขั้น</li>
                  <li>
                    แต่ละสกิลอัปแรงค์ได้สูงสุดที่ <strong>Rank 8</strong>
                  </li>
                  <li>
                    ถ้าอยากเปลี่ยนสกิลที่เคยเลือก ใช้ไอเทม <code>skill_forget</code> เพื่อรีเซ็ต
                  </li>
                </ul>
              </div>
            </section>

            <section id="guide-battle" className="guide-section">
              <ChapterHead num="07" title="การต่อสู้ & วิธีคิดดาเมจ" />
              <p className="guide-intro">ต่อสู้แบบผลัดเทิร์น 1v1 — สร้าง/เข้าห้องด้วยรหัส หรือฝึกกับ Bot ก่อนก็ได้</p>
              <div className="card guide-panel">
                <h4>ลำดับเทิร์น</h4>
                <div className="guide-flow-row">
                  <span className="guide-flow-pill">DEX สูงกว่า</span>
                  <span className="guide-flow-arrow">→</span>
                  <span className="guide-flow-pill">ได้เล่นก่อน</span>
                </div>
              </div>
              <div className="card guide-panel">
                <h4>ปัจจัยที่กำหนดดาเมจ</h4>
                <div className="guide-formula">
                  Damage ≈ STR หรือ INT (ตามชนิดสกิล) + ความได้เปรียบธาตุ + แรงค์สกิลที่อัปไว้
                </div>
                <p className="guide-note">
                  ยิ่งธาตุของท่าโจมตีมีข้อได้เปรียบเหนือธาตุคู่ต่อสู้ ยิ่งทำดาเมจได้มากขึ้น — เหมือนเกม element-based
                  ทั่วไป (ธาตุนี้แรงใส่ธาตุนั้น อ่อนใส่อีกธาตุ)
                </p>
              </div>
              <div className="card guide-panel">
                <h4>การกระทำในแต่ละเทิร์น</h4>
                <div className="guide-action-row">
                  <span className="guide-action-pill">⚔ Attack</span>
                  <span className="guide-action-pill">✦ Skill (ใช้ MP)</span>
                  <span className="guide-action-pill">🎒 Item</span>
                  <span className="guide-action-pill">🛡 Defend</span>
                  <span className="guide-action-pill">🏃 Flee</span>
                </div>
                <p className="guide-note">
                  ระหว่างต่อสู้ HP / MP / TP (Technique Points) จะคำนวณแยกเฉพาะในห้องนั้น ๆ ไม่กระทบค่าพื้นฐานถาวรของสัตว์
                </p>
              </div>
            </section>

            <section id="guide-breed" className="guide-section">
              <ChapterHead num="08" title="ผสมพันธุ์" />
              <p className="guide-intro">นำสัตว์ 2 ตัวมาผสมกันเพื่อสร้างไข่ใบใหม่</p>
              <div className="card guide-panel">
                <ul className="guide-spec-list">
                  <li>
                    ต้องใช้ไอเทม <code>breed_nest</code> 1 ชิ้น
                  </li>
                  <li>หลังผสมพันธุ์แล้วต้องรอ Cooldown ก่อนทำได้อีกครั้ง</li>
                  <li>ปัจจุบันลูกที่เกิดจะได้ธาตุ Pure เท่านั้น (ระบบบังคับชั่วคราว)</li>
                </ul>
              </div>
            </section>

            <section id="guide-economy" className="guide-section">
              <ChapterHead num="09" title="ภารกิจ & เศรษฐกิจในเกม" />
              <p className="guide-intro">ภารกิจคือทางหลักในการหา Gems ไปใช้ใน Market</p>
              <div className="guide-grid guide-grid-2">
                <div className="card guide-panel">
                  <h4>🗓 ภารกิจ</h4>
                  <p>
                    Daily และ Weekly Missions ที่ Sync ทั้งบนเครื่องและบนคลาวด์ ทำให้เล่นต่อเนื่องข้ามอุปกรณ์ได้
                  </p>
                </div>
                <div className="card guide-panel">
                  <h4>💎 Gems &amp; Market</h4>
                  <p>ทำภารกิจสำเร็จ → ได้ Gems → ใช้ซื้อไอเทมดูแลสัตว์ ของตกแต่ง หรือของใช้ในการต่อสู้/ผสมพันธุ์ที่ Market</p>
                </div>
              </div>
            </section>

            <section id="guide-more" className="guide-section">
              <ChapterHead num="10" title="มินิเกม & สังคม" />
              <div className="guide-grid guide-grid-2">
                <div className="card guide-panel">
                  <h4>🦖 Dino Jump</h4>
                  <p>เกมกระโดดหลบสิ่งกีดขวาง มีระบบ Ranking และ Best Score</p>
                </div>
                <div className="card guide-panel">
                  <h4>🪨 Rock Dodge</h4>
                  <p>เกมหลบหินตกลงมา ลุ้นรางวัลไอเทมรายวันจากอันดับคะแนน</p>
                </div>
              </div>
              <div className="card guide-panel">
                <h4>👥 ระบบสังคม</h4>
                <ul className="guide-spec-list">
                  <li>ค้นหาเพื่อนด้วย Friend Code</li>
                  <li>แชทในห้อง (Chat Rooms + Lobby)</li>
                  <li>ส่งของขวัญให้เพื่อน</li>
                  <li>ดูโปรไฟล์และ Collection ของผู้เล่นอื่น</li>
                </ul>
              </div>
            </section>

            <p className="guide-footer">{t('guide.footer')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
