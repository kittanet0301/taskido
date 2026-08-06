import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useTranslation } from 'react-i18next'

import techStackMd from '../../docs/TECH_STACK.md?raw'

import {

  ELEMENT_IDS,

  ELEMENT_STRONG_AGAINST,

  ELEMENT_RESIST_MULT,

  ELEMENT_SE_MULT,

  PURE_CHANCE,

  PURE_DAMAGE_BONUS,

  type ElementId

} from '../shared/elements'

import { MarkdownContent } from './MarkdownContent'

interface Props {

  onClose: () => void

}



const GUIDE_SECTION_IDS = [

  'howto',

  'species',

  'activity',

  'care',

  'rpgstat',

  'growth',

  'battle',

  'breed',

  'economy',

  'more'

] as const



const PLAY_STEP_IDS = ['login', 'activity', 'hatch', 'care', 'level', 'pvp', 'missions', 'social'] as const



const GUIDE_SCROLL_ANCHOR_PX = 96

type GuideModalTab = 'guide' | 'techStack'

const TECH_STACK_DISPLAY = techStackMd.split('\n## เอกสารที่เกี่ยวข้อง')[0]?.trimEnd() ?? techStackMd



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



const CARE_ITEM_IDS = [

  'food_basic',

  'food_premium',

  'medicine',

  'water',

  'toy',

  'dev_vitamin',

  'battle_shield',

  'breed_nest',

  'skill_forget'

] as const



const GROWTH_CARD_IDS = ['power_up', 'swift', 'focus', 'tough', 'bruiser', 'magelet', 'all_round'] as const



const GROWTH_CARD_ICONS: Record<(typeof GROWTH_CARD_IDS)[number], string> = {

  power_up: '💪',

  swift: '💨',

  focus: '🎯',

  tough: '🛡️',

  bruiser: '🥊',

  magelet: '🔮',

  all_round: '⚖️'

}



function elementsThatResist(attacker: ElementId): ElementId[] {

  return ELEMENT_IDS.filter((def) => (ELEMENT_STRONG_AGAINST[def] ?? []).includes(attacker))

}



function formatElementList(t: (key: string) => string, ids: ElementId[]): string {

  if (ids.length === 0) return '—'

  return ids.map((id) => t(`elements.${id}`)).join(', ')

}



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
  const techStackRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const [activeTab, setActiveTab] = useState<GuideModalTab>('guide')
  const [activeSection, setActiveSection] = useState<string>('howto')

  const purePct = Math.round(PURE_CHANCE * 100)

  const dualPct = 100 - purePct



  const guideSections = useMemo(

    () =>

      GUIDE_SECTION_IDS.map((id, index) => ({

        id,

        num: String(index + 1).padStart(2, '0'),

        title: t(`guide.sections.${id}`)

      })),

    [t]

  )



  useEffect(() => {
    if (activeTab !== 'guide') return

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

  }, [activeTab])



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



  const switchTab = useCallback((tab: GuideModalTab) => {
    setActiveTab(tab)
    contentRef.current?.scrollTo({ top: 0 })
    techStackRef.current?.scrollTo({ top: 0 })
  }, [])



  return (

    <div className="hub-modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>

      <div

        className="hub-modal hub-modal--lg guide-modal card"

        onClick={(e) => e.stopPropagation()}

        aria-labelledby="player-guide-title"

      >

        <div className="guide-modal-topbar">

          <div className="guide-modal-tabs" role="tablist" aria-label={t('guide.navLabel')}>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'guide'}
              className={`guide-modal-tab${activeTab === 'guide' ? ' guide-modal-tab--active' : ''}`}
              onClick={() => switchTab('guide')}
            >
              {t('guide.tabs.guide')}
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'techStack'}
              className={`guide-modal-tab${activeTab === 'techStack' ? ' guide-modal-tab--active' : ''}`}
              onClick={() => switchTab('techStack')}
            >
              {t('guide.tabs.techStack')}
            </button>

          </div>

          <button type="button" className="hub-modal-close" onClick={onClose} aria-label={t('common.cancel')}>

            ×

          </button>

        </div>



        <div className="hub-modal-head guide-modal-head">

          <h2 id="player-guide-title">
            {activeTab === 'guide' ? t('guide.tabs.guide') : t('guide.tabs.techStack')}
          </h2>

        </div>



        {activeTab === 'guide' ? (

        <div className="guide-modal-body">

          <nav ref={navRef} className="guide-nav" aria-label={t('guide.navLabel')}>

            <ul className="guide-nav-list">

              {guideSections.map((section) => (

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
                  {t('guide.hero.line1')} {t('guide.hero.line2')}
                </p>

                <div className="guide-tagbar">

                  <span className="guide-tag">{t('guide.hero.tagSpecies')}</span>

                  <span className="guide-tag">{t('guide.hero.tagPvp')}</span>

                  <span className="guide-tag">{t('guide.hero.tagBreed')}</span>

                  <span className="guide-tag">{t('guide.hero.tagPlatform')}</span>

                </div>



                <ChapterHead num="01" title={t('guide.hero.howtoTitle')} />

                <ol className="guide-steps">

                  {PLAY_STEP_IDS.map((stepId, index) => (

                    <li key={stepId} className="guide-step">

                      <span className="guide-step-num">{index + 1}</span>

                      <div>

                        <strong>{t(`guide.steps.${stepId}.title`)}</strong>

                        <p>{t(`guide.steps.${stepId}.body`)}</p>

                      </div>

                    </li>

                  ))}

                </ol>

              </div>

            </section>



            <section id="guide-species" className="guide-section">

              <ChapterHead num="02" title={t('guide.sections.species')} />

              <p className="guide-intro">{t('guide.species.intro')}</p>

              <div className="guide-species-grid">

                {ELEMENT_IDS.map((id) => (

                  <div key={id} className="guide-species-chip">

                    <span className="guide-swatch" style={{ background: ELEMENT_SWATCH[id] }} />

                    <div>

                      <div className="guide-species-name">{t(`elements.${id}`)}</div>

                      <div className="guide-species-hex">{ELEMENT_SWATCH[id]}</div>

                    </div>

                  </div>

                ))}

              </div>

              <div className="card guide-panel">

                <h4>{t('guide.species.hatchOddsTitle')}</h4>

                <div className="guide-prob-bar">

                  <div className="guide-prob-pure" style={{ width: `${purePct}%` }}>

                    {t('guide.species.pureLabel', { pct: purePct })}

                  </div>

                  <div className="guide-prob-dual" style={{ width: `${dualPct}%` }}>

                    {t('guide.species.dualLabel', { pct: dualPct })}

                  </div>

                </div>

                <p className="guide-note">{t('guide.species.pureDualNote')}</p>

              </div>

            </section>



            <section id="guide-activity" className="guide-section">

              <ChapterHead num="03" title={t('guide.sections.activity')} />

              <p className="guide-intro">{t('guide.activity.intro')}</p>

              <div className="card guide-panel">

                <h4>{t('guide.activity.formulaTitle')}</h4>

                <div className="guide-formula">{t('guide.activity.formula')}</div>

                <p className="guide-note">{t('guide.activity.formulaNote')}</p>

              </div>

              <div className="guide-grid guide-grid-3">

                <div className="card guide-panel">

                  <h4>{t('guide.activity.healthTitle')}</h4>

                  <p>{t('guide.activity.healthBody')}</p>

                </div>

                <div className="card guide-panel">

                  <h4>{t('guide.activity.emotionTitle')}</h4>

                  <p>{t('guide.activity.emotionBody')}</p>

                </div>

                <div className="card guide-panel">

                  <h4>{t('guide.activity.evolutionTitle')}</h4>

                  <p>

                    {t('guide.activity.evolutionBody', { vitamin: t('items.dev_vitamin.label') })}

                  </p>

                </div>

              </div>

              <div className="card guide-panel">

                <h4>{t('guide.activity.stagesTitle')}</h4>

                <div className="guide-stage-strip">

                  <div className="guide-stage-node">

                    <div className="guide-stage-sprite guide-stage-egg">🥚</div>

                    <div className="guide-stage-label">{t('stages.egg')}</div>

                    <div className="guide-stage-size">{t('guide.activity.stageSize', { size: '250px' })}</div>

                  </div>

                  <div className="guide-stage-arrow" />

                  <div className="guide-stage-node">

                    <div className="guide-stage-sprite guide-stage-baby">🐣</div>

                    <div className="guide-stage-label">{t('stages.baby')}</div>

                    <div className="guide-stage-size">{t('guide.activity.stageSize', { size: '250px' })}</div>

                  </div>

                  <div className="guide-stage-arrow" />

                  <div className="guide-stage-node">

                    <div className="guide-stage-sprite guide-stage-adult">🐉</div>

                    <div className="guide-stage-label">{t('stages.adult')}</div>

                    <div className="guide-stage-size">{t('guide.activity.stageSize', { size: '500px' })}</div>

                  </div>

                </div>

                <p className="guide-note">{t('guide.activity.stagesNote')}</p>

              </div>

            </section>



            <section id="guide-care" className="guide-section">

              <ChapterHead num="04" title={t('guide.care.title')} />

              <p className="guide-intro">{t('guide.care.intro')}</p>

              <div className="card guide-panel">

                <table className="guide-calc-table">

                  <thead>

                    <tr>

                      <th>{t('guide.care.itemCol')}</th>

                      <th>{t('guide.care.effectCol')}</th>

                    </tr>

                  </thead>

                  <tbody>

                    {CARE_ITEM_IDS.map((itemId) => (

                      <tr key={itemId}>

                        <td className="guide-calc-name">{t(`items.${itemId}.label`)}</td>

                        <td>{t(`items.${itemId}.description`)}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

              <p className="guide-note">{t('guide.care.quickCareNote')}</p>

            </section>



            <section id="guide-rpgstat" className="guide-section">

              <ChapterHead num="05" title={t('guide.rpgstat.title')} />

              <p className="guide-intro">{t('guide.rpgstat.intro')}</p>

              <div className="guide-grid guide-grid-2">

                <div className="card guide-panel">

                  <h4>{t('guide.rpgstat.primaryTitle')}</h4>

                  <div className="guide-stat-grid">

                    <div className="guide-stat-core guide-stat-str">

                      <div className="guide-stat-letters">STR</div>

                      <div className="guide-stat-name">{t('guide.rpgstat.strName')}</div>

                    </div>

                    <div className="guide-stat-core guide-stat-dex">

                      <div className="guide-stat-letters">DEX</div>

                      <div className="guide-stat-name">{t('guide.rpgstat.dexName')}</div>

                    </div>

                    <div className="guide-stat-core guide-stat-int">

                      <div className="guide-stat-letters">INT</div>

                      <div className="guide-stat-name">{t('guide.rpgstat.intName')}</div>

                    </div>

                    <div className="guide-stat-core guide-stat-con">

                      <div className="guide-stat-letters">CON</div>

                      <div className="guide-stat-name">{t('guide.rpgstat.conName')}</div>

                    </div>

                  </div>

                </div>

                <div className="card guide-panel">

                  <h4>{t('guide.rpgstat.derivedTitle')}</h4>

                  <div className="guide-formula">

                    {t('guide.rpgstat.derived1')}

                    <br />

                    {t('guide.rpgstat.derived2')}

                    <br />

                    {t('guide.rpgstat.derived3')}

                    <br />

                    {t('guide.rpgstat.derived4')}

                  </div>

                </div>

              </div>

              <p className="guide-note">{t('guide.rpgstat.summaryNote')}</p>

            </section>



            <section id="guide-growth" className="guide-section">

              <ChapterHead num="06" title={t('guide.growth.title')} />

              <p className="guide-intro">{t('guide.growth.intro')}</p>

              <div className="card guide-panel">

                <h4>{t('guide.growth.loopTitle')}</h4>

                <div className="guide-loop-row">

                  <div className="guide-loop-box guide-loop-box--hi">{t('guide.growth.loopLevel')}</div>

                  <span className="guide-loop-arrow">→</span>

                  <div className="guide-loop-box">

                    {t('guide.growth.loopCardLine1')}

                    <br />

                    {t('guide.growth.loopCardLine2')}

                  </div>

                  <span className="guide-loop-arrow">+</span>

                  <div className="guide-loop-box">

                    {t('guide.growth.loopSkillLine1')}

                    <br />

                    {t('guide.growth.loopSkillLine2')}

                  </div>

                </div>

              </div>

              <div className="card guide-panel">

                <h4>{t('guide.growth.cardsTitle')}</h4>

                <p className="guide-note" style={{ marginTop: 0, marginBottom: 12 }}>

                  {t('guide.growth.cardsIntro')}

                </p>

                <div className="guide-grid guide-grid-3">

                  {GROWTH_CARD_IDS.map((cardId) => (

                    <div key={cardId} className="guide-gcard">

                      <span className="guide-gcard-icon">{GROWTH_CARD_ICONS[cardId]}</span>

                      <div className="guide-gcard-name">{t(`growth.${cardId}`)}</div>

                      <div className="guide-gcard-desc">{t(`guide.growth.cardDesc.${cardId}`)}</div>

                    </div>

                  ))}

                </div>

              </div>

              <div className="card guide-panel">

                <h4>{t('guide.growth.skillsTitle')}</h4>

                <ul className="guide-spec-list">

                  <li>{t('guide.growth.skills1')}</li>

                  <li>{t('guide.growth.skills2')}</li>

                  <li>{t('guide.growth.skills3')}</li>

                  <li>{t('guide.growth.skills4', { item: t('items.skill_forget.label') })}</li>

                </ul>

              </div>

            </section>



            <section id="guide-battle" className="guide-section">

              <ChapterHead num="07" title={t('guide.battle.title')} />

              <p className="guide-intro">{t('guide.battle.intro')}</p>

              <div className="card guide-panel">

                <h4>{t('guide.battle.turnTitle')}</h4>

                <div className="guide-flow-row">

                  <span className="guide-flow-pill">{t('guide.battle.turnHigherDex')}</span>

                  <span className="guide-flow-arrow">→</span>

                  <span className="guide-flow-pill">{t('guide.battle.turnGoesFirst')}</span>

                </div>

              </div>

              <div className="card guide-panel">

                <h4>{t('guide.battle.damageTitle')}</h4>

                <div className="guide-formula">{t('guide.battle.damageFormula')}</div>

                <p className="guide-note">{t('guide.battle.damageNote')}</p>

              </div>

              <div className="card guide-panel">

                <h4>{t('guide.battle.elementTitle')}</h4>

                <p className="guide-note guide-note--spaced">{t('guide.battle.elementIntro')}</p>

                <div className="guide-element-mults">

                  <div className="guide-element-mult guide-element-mult--se">

                    <span className="guide-element-mult-label">{t('guide.battle.elementSe')}</span>

                    <span className="guide-element-mult-value">×{ELEMENT_SE_MULT}</span>

                  </div>

                  <div className="guide-element-mult guide-element-mult--resist">

                    <span className="guide-element-mult-label">{t('guide.battle.elementResist')}</span>

                    <span className="guide-element-mult-value">×{ELEMENT_RESIST_MULT}</span>

                  </div>

                  <div className="guide-element-mult guide-element-mult--neutral">

                    <span className="guide-element-mult-label">{t('guide.battle.elementNeutral')}</span>

                    <span className="guide-element-mult-value">×1.0</span>

                  </div>

                </div>

                <table className="guide-calc-table guide-element-table">

                  <thead>

                    <tr>

                      <th>{t('guide.battle.elementAtkCol')}</th>

                      <th>{t('guide.battle.elementStrongCol')}</th>

                      <th>{t('guide.battle.elementWeakCol')}</th>

                    </tr>

                  </thead>

                  <tbody>

                    {ELEMENT_IDS.map((id) => (

                      <tr key={id}>

                        <td className="guide-calc-name guide-element-name">

                          <span className="guide-swatch guide-swatch--inline" style={{ background: ELEMENT_SWATCH[id] }} />

                          {t(`elements.${id}`)}

                        </td>

                        <td>{formatElementList(t, ELEMENT_STRONG_AGAINST[id])}</td>

                        <td>{formatElementList(t, elementsThatResist(id))}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

                <ul className="guide-spec-list guide-element-notes">

                  <li>{t('guide.battle.elementNote1')}</li>

                  <li>{t('guide.battle.elementNote2', { bonus: PURE_DAMAGE_BONUS })}</li>

                </ul>

              </div>

              <div className="card guide-panel">

                <h4>{t('guide.battle.actionsTitle')}</h4>

                <div className="guide-action-row">

                  <span className="guide-action-pill">{t('guide.battle.actionAttack')}</span>

                  <span className="guide-action-pill">{t('guide.battle.actionSkill')}</span>

                  <span className="guide-action-pill">{t('guide.battle.actionItem')}</span>

                  <span className="guide-action-pill">{t('guide.battle.actionDefend')}</span>

                  <span className="guide-action-pill">{t('guide.battle.actionFlee')}</span>

                </div>

                <p className="guide-note">{t('guide.battle.combatNote')}</p>

              </div>

            </section>



            <section id="guide-breed" className="guide-section">

              <ChapterHead num="08" title={t('guide.sections.breed')} />

              <p className="guide-intro">{t('guide.breed.intro')}</p>

              <div className="card guide-panel">

                <ul className="guide-spec-list">

                  <li>{t('guide.breed.item', { item: t('items.breed_nest.label') })}</li>

                  <li>{t('guide.breed.cooldown')}</li>

                  <li>{t('guide.breed.pureOnly')}</li>

                </ul>

              </div>

            </section>



            <section id="guide-economy" className="guide-section">

              <ChapterHead num="09" title={t('guide.economy.title')} />

              <p className="guide-intro">{t('guide.economy.intro')}</p>

              <div className="guide-grid guide-grid-2">

                <div className="card guide-panel">

                  <h4>{t('guide.economy.missionsTitle')}</h4>

                  <p>{t('guide.economy.missionsBody')}</p>

                </div>

                <div className="card guide-panel">

                  <h4>{t('guide.economy.marketTitle')}</h4>

                  <p>{t('guide.economy.marketBody')}</p>

                </div>

              </div>

            </section>



            <section id="guide-more" className="guide-section">

              <ChapterHead num="10" title={t('guide.sections.more')} />

              <div className="guide-grid guide-grid-2">

                <div className="card guide-panel">

                  <h4>{t('guide.more.dinoJumpTitle')}</h4>

                  <p>{t('guide.more.dinoJumpBody')}</p>

                </div>

                <div className="card guide-panel">

                  <h4>{t('guide.more.rockDodgeTitle')}</h4>

                  <p>{t('guide.more.rockDodgeBody')}</p>

                </div>

              </div>

              <div className="card guide-panel">

                <h4>{t('guide.more.socialTitle')}</h4>

                <ul className="guide-spec-list">

                  <li>{t('guide.more.social1')}</li>

                  <li>{t('guide.more.social2')}</li>

                  <li>{t('guide.more.social3')}</li>

                  <li>{t('guide.more.social4')}</li>

                </ul>

              </div>

            </section>



            <p className="guide-footer">{t('guide.footer')}</p>

          </div>

        </div>

        ) : (

        <div ref={techStackRef} className="guide-techstack-body">

          <MarkdownContent source={TECH_STACK_DISPLAY} />

        </div>

        )}

      </div>

    </div>

  )

}


