// The learner's exam screens, in English and Hindi. Shares the language switch of the other hw screens (useHwT), keeps its own table so the
// big hw strings module does not grow further. Hindi should be reviewed by a native speaker before launch.

import { useCallback } from 'react'
import { useHwT } from '@/components/hw/strings'

const en = {
  'ex.title': 'Board exam practice',
  'ex.subtitle': 'Past papers, sample papers and mock tests, written by hand against the clock',
  'ex.catalogue.none': 'No exam packages are open yet.',
  'ex.access.active': 'In your plan',
  'ex.access.until': 'Until {date}',
  'ex.access.expired': 'Access ended',
  'ex.access.refunded': 'Refunded',
  'ex.access.none': 'Not in your plan',
  'ex.access.ask': 'This package is not part of your plan yet.',
  'ex.pkg.meta': '{board} · Class {cls} · {year} boards',
  'ex.pkg.sets': '{n} tests',
  'ex.pkg.attempts': '{n} attempts at each test',
  'ex.pkg.free': 'Free',
  'ex.pkg.open': 'Open',
  'ex.back': 'All packages',
  'ex.kind.pyq': 'Past paper',
  'ex.kind.sqp': 'Sample paper',
  'ex.kind.mock_half': 'Half-syllabus mock',
  'ex.kind.mock_full': 'Full-syllabus mock',
  'ex.set.meta': '{marks} marks · {min} minutes · {q} questions',
  'ex.set.used': 'Attempts: {used} of {allowed}',
  'ex.set.start': 'Start attempt {n}',
  'ex.set.resume': 'Go back to your open test',
  'ex.set.none': 'No tests are open in this package yet.',
  'ex.confirm.title': 'Start “{title}”?',
  'ex.confirm.body': 'The clock starts as soon as you press Start and keeps running even if you close this page. You have {min} minutes to write, then {grace} minutes to photograph and upload your pages. Keep blank paper and a pen ready.',
  'ex.confirm.go': 'Start now',
  'ex.confirm.cancel': 'Not yet',
  'ex.a.status.started': 'Writing',
  'ex.a.status.time_up': 'Time up — upload pages',
  'ex.a.status.uploaded': 'Pages uploaded',
  'ex.a.status.evaluating': 'Being marked',
  'ex.a.status.reported': 'Report ready',
  'ex.a.status.abandoned': 'Not completed',
  'ex.a.row': 'Attempt {n} · {date}',
  'ex.a.open': 'Open',
  'ex.t.left': 'Time left',
  'ex.t.upload': 'Upload closes in',
  'ex.t.attempt': 'Attempt {n}',
  'ex.t.finish': 'I have finished writing',
  'ex.t.finishConfirm': 'Stop the clock now? You cannot write any more after this.',
  'ex.t.giveUp': 'Give up this attempt',
  'ex.t.giveUpConfirm': 'Give up? This still counts as one of your attempts.',
  'ex.t.instructions': 'Write your answers on paper, in your own handwriting. Number each answer as it is numbered here. When the time is up, photograph every page.',
  'ex.t.timeUp': 'Time is up. Put your pen down.',
  'ex.t.uploadSoon': 'Photographing and uploading your pages opens in the next update. Your attempt is saved.',
  'ex.t.closed': 'This attempt is closed.',
  'ex.t.closed.no_pages_uploaded': 'No pages were uploaded before the upload time ended.',
  'ex.t.closed.given_up': 'You gave up this attempt.',
  'ex.t.backToPackage': 'Back to the package',
  'ex.q': 'Q{n}',
  'ex.q.or': 'OR',
  'ex.q.section': 'Section {s}',
  'ex.q.marks': '{n} marks',
  'ex.q.mark': '{n} mark',
  'ex.q.figure': 'Figure',
} as const

export type ExKey = keyof typeof en

const hi: Record<ExKey, string> = {
  'ex.title': 'बोर्ड परीक्षा अभ्यास',
  'ex.subtitle': 'पिछले वर्षों के प्रश्नपत्र, नमूना प्रश्नपत्र और मॉक परीक्षाएँ — समय सीमा में, अपनी लिखावट में',
  'ex.catalogue.none': 'अभी कोई परीक्षा पैकेज खुला नहीं है।',
  'ex.access.active': 'आपकी योजना में',
  'ex.access.until': '{date} तक',
  'ex.access.expired': 'पहुँच समाप्त',
  'ex.access.refunded': 'पैसा लौटाया गया',
  'ex.access.none': 'आपकी योजना में नहीं',
  'ex.access.ask': 'यह पैकेज अभी आपकी योजना में शामिल नहीं है।',
  'ex.pkg.meta': '{board} · कक्षा {cls} · {year} बोर्ड परीक्षा',
  'ex.pkg.sets': '{n} परीक्षाएँ',
  'ex.pkg.attempts': 'हर परीक्षा के {n} प्रयास',
  'ex.pkg.free': 'निःशुल्क',
  'ex.pkg.open': 'खोलें',
  'ex.back': 'सभी पैकेज',
  'ex.kind.pyq': 'पिछले वर्ष का प्रश्नपत्र',
  'ex.kind.sqp': 'नमूना प्रश्नपत्र',
  'ex.kind.mock_half': 'आधे पाठ्यक्रम की मॉक परीक्षा',
  'ex.kind.mock_full': 'पूरे पाठ्यक्रम की मॉक परीक्षा',
  'ex.set.meta': '{marks} अंक · {min} मिनट · {q} प्रश्न',
  'ex.set.used': 'प्रयास: {allowed} में से {used}',
  'ex.set.start': 'प्रयास {n} शुरू करें',
  'ex.set.resume': 'अपनी खुली परीक्षा पर लौटें',
  'ex.set.none': 'इस पैकेज में अभी कोई परीक्षा खुली नहीं है।',
  'ex.confirm.title': '“{title}” शुरू करें?',
  'ex.confirm.body': 'शुरू करें दबाते ही घड़ी चलने लगेगी और यह पेज बंद करने पर भी चलती रहेगी। लिखने के लिए आपके पास {min} मिनट हैं, फिर पन्नों की फ़ोटो लेकर अपलोड करने के लिए {grace} मिनट। खाली कागज़ और पेन तैयार रखें।',
  'ex.confirm.go': 'अभी शुरू करें',
  'ex.confirm.cancel': 'अभी नहीं',
  'ex.a.status.started': 'लिख रहे हैं',
  'ex.a.status.time_up': 'समय समाप्त — पन्ने अपलोड करें',
  'ex.a.status.uploaded': 'पन्ने अपलोड हो गए',
  'ex.a.status.evaluating': 'जाँच जारी है',
  'ex.a.status.reported': 'रिपोर्ट तैयार',
  'ex.a.status.abandoned': 'पूरा नहीं हुआ',
  'ex.a.row': 'प्रयास {n} · {date}',
  'ex.a.open': 'खोलें',
  'ex.t.left': 'बचा समय',
  'ex.t.upload': 'अपलोड बंद होगा',
  'ex.t.attempt': 'प्रयास {n}',
  'ex.t.finish': 'मैंने लिखना पूरा कर लिया',
  'ex.t.finishConfirm': 'घड़ी अभी रोकें? इसके बाद आप और नहीं लिख सकेंगे।',
  'ex.t.giveUp': 'यह प्रयास छोड़ दें',
  'ex.t.giveUpConfirm': 'छोड़ दें? यह फिर भी आपके प्रयासों में गिना जाएगा।',
  'ex.t.instructions': 'अपने उत्तर कागज़ पर, अपनी लिखावट में लिखें। हर उत्तर पर वही क्रमांक लिखें जो यहाँ है। समय समाप्त होने पर हर पन्ने की फ़ोटो लें।',
  'ex.t.timeUp': 'समय समाप्त। पेन रख दें।',
  'ex.t.uploadSoon': 'पन्नों की फ़ोटो लेकर अपलोड करना अगले अपडेट में शुरू होगा। आपका प्रयास सहेजा गया है।',
  'ex.t.closed': 'यह प्रयास बंद हो गया है।',
  'ex.t.closed.no_pages_uploaded': 'अपलोड का समय समाप्त होने से पहले कोई पन्ना अपलोड नहीं हुआ।',
  'ex.t.closed.given_up': 'आपने यह प्रयास छोड़ दिया।',
  'ex.t.backToPackage': 'पैकेज पर लौटें',
  'ex.q': 'प्र.{n}',
  'ex.q.or': 'अथवा',
  'ex.q.section': 'खंड {s}',
  'ex.q.marks': '{n} अंक',
  'ex.q.mark': '{n} अंक',
  'ex.q.figure': 'चित्र',
}

const TABLES = { en, hi } as const

export function useExamT() {
  const { lang } = useHwT()
  const t = useCallback((key: ExKey, vars?: Record<string, string | number>) => {
    let s: string = TABLES[lang][key] ?? en[key]
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
    return s
  }, [lang])
  /** A server message carries both languages as "English / हिन्दी"; show the half for this screen's language. */
  const pick = useCallback((msg: string) => {
    const i = msg.indexOf(' / ')
    if (i < 0) return msg
    return lang === 'hi' ? msg.slice(i + 3) : msg.slice(0, i)
  }, [lang])
  const date = useCallback((d: Date | string) => new Date(d).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' }), [lang])
  return { t, lang, pick, date }
}

/** mm:ss, or h:mm:ss for long papers. Never negative. */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`
}
