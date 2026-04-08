from __future__ import annotations

import re
from typing import Iterable, List


def _resolve_speaker_line(speaker: str) -> str:
    return {
        "none": "화자 설정 없음. 일반적인 전문 콘텐츠 라이터 시점으로 작성합니다.",
        "doctor": "화자: 미용의료클리닉 원장. 의료적 판단과 신뢰감을 더 강하게 드러냅니다.",
        "director": "화자: 상담실장. 상담 현장에서 자주 받는 질문에 답하듯 친절하게 설명합니다.",
        "columnist": "화자: 미용칼럼니스트. 비교와 맥락 정리에 강한 칼럼형 톤으로 작성합니다.",
    }.get(speaker, "화자 설정 없음. 일반적인 전문 콘텐츠 라이터 시점으로 작성합니다.")


def _common_header(
    clinic_name: str,
    keyword: str,
    related: str,
    tone: str,
    speaker: str,
    custom_instruction: str,
    seo_profile: dict,
    korean_keyword: str,
) -> str:
    speaker_line = _resolve_speaker_line(speaker)
    return f"""あなたは美容クリニックのSEOコンテンツライターです。
日本語ネイティブの読者向けに、自然で読みやすい記事を書いてください。

共通ルール:
- 文字数: 3,000〜4,500文字を目安に、途中で切れない完全原稿にする
- 語尾は「です・ます」調
- 医療広告ガイドラインに準拠
- クリニック名は自然に2〜3回言及
- 最後に120文字以内のメタディスクリプションを出力
- トーン: {tone}
- {speaker_line}
- 추가 사용자 지시: {custom_instruction or "없음"}
- 出力は必ず最後の `---META---` まで完結させる
- セクション名やプレースホルダーを省略しない
- 本文中に画像挿入位置とCTAバナー挿入位置を明示する
- 管理者が日本語だけでなく韓国語でも検토できるよう、短い韓国語確認メモを付ける
- SEO ブロックの `Description` は 120文字前後の短い説明文だけを書く
- `Description` 内に H1/H2, FAQ, 本文, `<aside>` の追記, チェックリストを入れない
- `## 한국어 확인 메모` と `## 제목 :` は必ず SEO ブロックの外に独立して書く
- Google SEO と GEO(生成AI回答) の両方に有利なように、冒頭で結論を先に提示し、本文では比較・理由・注意点・FAQ を 충분히 서술する
- どのセクションも1〜2文で終わらせず、各H2ごとに具体例・判断基準・患者が気にする不安要素まで掘り下げる
- FAQ は 최소 3問以上 작성する
- 本文が短くならないよう、各 H2 セクションは少なくとも 2段落 이상으로 작성한다
- 比較・費用・効果・ダウンタイムなど、並列情報は積極的に **Markdownテーブル** で整理する（例: 施術比較表、費用目安表、ダウンタイム比較表）
- テーブルは最低2列×3行以上で、読者が一目で判断できる密度を保つ

画像スロットルール:
- [IMAGE_SLOT] にはAI画像生成用のプロンプト例を `prompt:` フィールドで必ず付ける
- プロンプトは Gemini / DALL-E で直接使えるように、英語で具体的に書く
- 形式: `[IMAGE_SLOT: スロット名 | alt: 日本語alt文 | prompt: 英語の画像生成プロンプト]`
- 例: `[IMAGE_SLOT: hero-image | alt: リジュランが肌に注入される様子のイメージ | prompt: Medical illustration of rejuran healer being injected into facial skin layers, cross-section view showing PDRN reaching dermis, clean clinical style, soft lighting, professional medical infographic]`

SEOガイド:
- ターゲットキーワードの主軸語は本文全体で {seo_profile['main_keyword_frequency']} 程度を目安に自然に配置
- 地域語は {seo_profile['location_frequency']} 程度を目安に、同じ単語だけを繰り返さずに交差使用
- ベリエーションは最低 {seo_profile['variation_count']} 種以上を混ぜる
- 同じキーワード句を3文連続で繰り返さない
- キーワード密度は本文全体で 1.5%〜2.5% を目安にする
- スラッグは {seo_profile['recommended_slug']} を推奨
 - スラッグは `施術-主題-主題詳細-地域` の4段構成で作る
- 地域語の比率は gangnam 62%, seoul 25%, korea単独 13% を基本に考える
- 既存記事のスラッグは変えない前提で、新規記事用の推奨スラッグのみ提案する

クリニック名: {clinic_name}
ターゲットキーワード: {keyword}
ターゲットキーワード韓国語参考: {korean_keyword}
関連キーワード: {related}"""


def _common_output_format() -> str:
    return """出力形式:
## SEO
<aside>
✅

Title: (SEOタイトル)
</aside>

<aside>
✅

Meta Image: (대표 이미지용 짧은 한글 라벨)
</aside>

<aside>
✅

Description: (120文字以内の説明文)
</aside>

---SLUG---
(推奨スラッグ)

## 한국어 확인 메모
- 메인 키워드 한국어 해석: (짧고 자연스럽게)
- 글의 핵심 포인트: (2~3문장)
- 추천 CTA 포인트: (짧게)
- 추천 이미지 자리 요약: (어떤 이미지가 들어가야 하는지)

## 제목 : (本文タイトルをそのまま再掲)

(以下本文は Markdown で出力)

重要:
- 한국어 확인 메모를 생략하지 말 것
- 이미지 슬롯과 CTA 배너 슬롯을 생략하지 말 것
- 글이 짧아지면 안 되며, SEO/GEO용 정보문서답게 충분한 길이와 맥락을 유지할 것
- SEO 블록에는 Title / Meta Image / Description / Slug 외의 내용을 넣지 말 것"""


def _hero_intent_block() -> str:
    return """
コンテンツ戦略: **Hero（高転換型ランディングコンテンツ）**

Hero記事の特別ルール:
- 見出し構成: H1(タイトル) → 導入(結論先出し) → H2(4〜5個) → FAQ → まとめ
- **強力なCTA**: 価格情報、現在のキャンペーン/イベント、クリニック所在地（江南駅○番出口）、1:1カウンセリング予約リンクを具体的に言及
- CTAは本文中間1回 + FAQ直後1回 + 文末1回の **計3回** 配置
- 価格・費用に関する情報を可能な限り具体的に提示（目安価格、パッケージ、割引条件）
- 予約の緊急性を自然に演出（「今月限定」「先着○名」などは使わず、カウンセリングの価値を強調）
- ビフォーアフターのイメージスロットを必ず含める

本文構成:
- 冒頭あいさつ文（結論→メリットを先出し）
- 導入（なぜ今この施術が注目されているか）
- [IMAGE_SLOT: hero-image | alt: 施術のイメージ写真 | prompt: (施術部位・効果をイメージできるクリニカルなイラスト、英語で具体的に)]
- H2: 施術の効果と特徴（**効果の比較テーブル**を含める）
- H2: 料金・費用の目安（**費用テーブル**を含める：メニュー、回数、目安価格）
- [CTA_BANNER: mid-consultation | message: 今すぐ無料カウンセリングを予約する]
- H2: 施術の流れとダウンタイム
- [IMAGE_SLOT: before-after-or-clinic | alt: 施術前後のイメージ | prompt: (ビフォーアフター風のイラスト or クリニック施術室の雰囲気、英語で具体的に)]
- H2: 他施術との比較（**比較テーブル**を含める）
- FAQ（3問以上）
- [CTA_BANNER: pre-summary | message: お気軽にご相談ください]
- まとめ
- [CTA_BANNER: final-booking | message: ご予約・お問い合わせはこちら]"""


def _hub_intent_block() -> str:
    return """
コンテンツ戦略: **Hub（比較・意思決定支援型コンテンツ）**

Hub記事の特別ルール:
- 見出し構成: H1(タイトル) → 導入 → H2(4〜5個、比較中心) → FAQ → まとめ
- **客観的な比較データ**: 施術別の長所・短所の比較表、持続期間、痛みレベル、ダウンタイム比較を必ずテーブル形式で挿入
- CTAは控えめに本文中間1回 + 文末1回の **計2回**（情報提供が主目的）
- CTA文言は「詳しくはカウンセリングで」「ご自身に合った施術をご相談」など柔らかい表現
- 読者が自分に合った選択肢を判断できるよう、判断基準を明確に提示
- 複数施術を公平に扱い、特定施術だけを推すトーンにしない

本文構成:
- 冒頭あいさつ文
- 導入（比較の必要性・読者の悩みに共感）
- [IMAGE_SLOT: hero-image | alt: 比較対象の施術イメージ | prompt: (比較する複数の施術機器やプロセスを並べたインフォグラフィック、英語で具体的に)]
- H2: 各施術の概要と特徴
- H2: 比較表（**必ずMarkdownテーブル**で効果・持続期間・痛み・費用・ダウンタイムを比較）
- [CTA_BANNER: mid-consultation | message: どの施術が合うかカウンセリングで相談する]
- H2: こんな人にはこの施術がおすすめ（タイプ別提案、**タイプ別おすすめテーブル**含む）
- [IMAGE_SLOT: comparison-table-or-device | alt: 施術機器の比較イメージ | prompt: (比較対象の美容機器を並べた写真風イラスト、英語で具体的に)]
- H2: 施術を選ぶ際の注意点
- FAQ（3問以上）
- まとめ
- [CTA_BANNER: final-booking | message: お気軽にご相談ください]"""


def _hygiene_intent_block() -> str:
    return """
コンテンツ戦略: **Hygiene（情報型・信頼構築コンテンツ）**

Hygiene記事の特別ルール:
- 見出し構成: H1(タイトル) → 導入 → H2(4〜5個、教育中心) → FAQ(5問以上) → まとめ
- **E-E-A-T重視**: 専門家としての知見、エビデンスに基づく説明、施術原理の丁寧な解説
- FAQを **5問以上** に拡充し、患者が検索しそうな疑問を網羅
- CTAは文末1回のみ（「もっと詳しく知りたい方は」程度の柔らかいトーン）
- 副作用・リスク・注意点を正直に記載し、信頼感を優先
- ケア方法・術後管理・予防ガイドなど実用的な情報を充実させる
- 内部リンクで Hub/Hero 記事への導線を意識した文脈を入れる

本文構成:
- 冒頭あいさつ文
- 導入（この情報を知ることの価値）
- [IMAGE_SLOT: hero-image | alt: 施術の原理を示すイメージ | prompt: (施術の作用メカニズムを示す断面図や医学的イラスト、英語で具体的に)]
- H2: 施術・テーマの基本原理（**メカニズムや成分をテーブル**で整理）
- H2: 効果とメカニズム
- H2: 副作用・リスクと対処法（**副作用の種類・頻度・対処法テーブル**を含める）
- [IMAGE_SLOT: process-or-diagram | alt: 施術プロセスの図解 | prompt: (施術ステップを示すフローチャート風インフォグラフィック、英語で具体的に)]
- H2: 術後ケア・管理ガイド
- FAQ（5問以上）
- まとめ
- [CTA_BANNER: final-booking | message: ご不明な点はお気軽にお問い合わせください]"""


def build_blog_prompt(
    clinic_name: str,
    keyword: str,
    related_keywords: Iterable[str],
    tone: str,
    speaker: str,
    custom_instruction: str,
    intent_segment: str = "auto",
) -> str:
    related = ", ".join(related_keywords)
    seo_profile = build_seo_profile(keyword)
    korean_keyword = translate_keyword_hint(keyword)

    header = _common_header(
        clinic_name, keyword, related, tone, speaker,
        custom_instruction, seo_profile, korean_keyword,
    )

    # Select intent-specific block
    if intent_segment == "hero":
        intent_block = _hero_intent_block()
    elif intent_segment == "hub":
        intent_block = _hub_intent_block()
    elif intent_segment == "hygiene":
        intent_block = _hygiene_intent_block()
    else:
        # auto: default to the original balanced structure
        intent_block = _hero_intent_block()

    output_format = _common_output_format()

    return f"""{header}

{intent_block}

{output_format}

---META---
(Description と同じでもよいが、最終メタ文をもう一度)""".strip()


def build_continuation_prompt(existing_text: str) -> str:
    trimmed = existing_text.strip()
    tail = trimmed[-2400:]
    return f"""
あなたは先ほどのSEO/GEO記事を続けて書くライターです。
以下は、すでに生成された原稿の末尾部分です。

既存原稿（末尾）:
{tail}

指示:
- 既存内容を繰り返さず、その直後から自然につなげて続ける
- 文章が途中で切れている場合は、その文を自然に完結してから続ける
- まだ出ていない必須ブロックを最後まで必ず完成させる
- 特に FAQ, まとめ, 2つの CTA バナー, 2つの IMAGE_SLOT, `---META---` が抜けないようにする
- もし H2 が 4個未満なら、不足している H2 セクションも補って完成させる
- 出力は必ず自然な文の終わりで終える
- 出力は続き本文だけを返し、冒頭から書き直さない
""".strip()


def is_draft_complete(text: str) -> bool:
    required_markers = ["## SEO", "## 한국어 확인 메모", "---SLUG---", "---META---", "FAQ"]
    if not all(marker in text for marker in required_markers):
        return False
    if text.count("[IMAGE_SLOT:") < 2:
        return False
    if text.count("[CTA_BANNER:") < 2:
        return False
    if len(re.findall(r"^##\s+", text, re.MULTILINE)) < 4:
        return False
    return len(text) >= 4200 and text.rstrip().endswith(("。", "！", "？", ".", "」", "』"))


def build_seo_profile(keyword: str) -> dict:
    text = keyword.lower()
    if any(token in text for token in ["料金", "値段", "おすすめ", "予約", "江南", "韓国", "リジュラン", "ウルセラ", "サーマ", "糸リフト"]):
        main_keyword_frequency = "4〜6回"
        location_frequency = "6〜8回"
    else:
        main_keyword_frequency = "3〜5回"
        location_frequency = "5〜7回"

    if any(token in text for token in ["リジュラン", "ボトックス", "フィラー"]):
        main_keyword_frequency = "3〜5回"
        location_frequency = "5〜7回"

    return {
        "main_keyword_frequency": main_keyword_frequency,
        "location_frequency": location_frequency,
        "variation_count": "3",
        "recommended_slug": recommend_slug(keyword),
    }


def recommend_slug(keyword: str) -> str:
    normalized = keyword.lower()
    treatment_map = [
        (r"(ウルセラプライム|ultherapy prime)", "ultherapy-prime"),
        (r"(ウルセラ|ultherapy)", "ultherapy"),
        (r"(サーマクール|サーマジ|thermage)", "thermage"),
        (r"(リジュラン|rejuran)", "rejuran"),
        (r"(ボトックス|botox)", "botox"),
        (r"(フィラー|filler|ヒアルロン酸)", "filler"),
        (r"(糸リフト|スレッドリフト|thread lift)", "thread-lift"),
        (r"(ハイフ|hifu)", "hifu"),
        (r"(オンダ)", "onda-lifting"),
        (r"(オールタイト)", "alltite"),
        (r"(オリジオ)", "oligio"),
        (r"(ボルニューマ)", "volnewmer"),
        (r"(美容クリニック)", "beauty-clinic"),
        (r"(皮膚科)", "dermatology"),
        (r"(肌管理)", "skin-care"),
        (r"(リフトアップ)", "liftup-clinic"),
    ]
    treatment_slug = "beauty-clinic"
    for pattern, slug in treatment_map:
        if re.search(pattern, normalized, re.IGNORECASE):
            treatment_slug = slug
            break

    if "江南" in keyword:
        location_slug = "gangnam"
    elif "ソウル" in keyword or "서울" in keyword:
        location_slug = "seoul"
    else:
        location_slug = "korea"

    def first_match(rules: List[tuple[str, str]], fallback: str) -> str:
        for pattern, slug in rules:
            if re.search(pattern, normalized, re.IGNORECASE):
                return slug
        return fallback

    main_topic = first_match(
        [
            (r"(料金|値段|price|安い|費用|コスト)", "price"),
            (r"(効果|持続|結果|ビフォー|アフター)", "effect"),
            (r"(痛み|無痛|麻酔)", "pain"),
            (r"(ダウンタイム|腫れ|赤み|回復)", "downtime"),
            (r"(比較|違い|vs|versus)", "comparison"),
            (r"(正品|認証|本物|タッチプライム|安全)", "authenticity"),
            (r"(おすすめ|名医|選び方|クリニック)", "clinic-choice"),
            (r"(副作用|リスク|注意)", "safety"),
        ],
        "guide",
    )

    topic_detail = first_match(
        [
            (r"(無痛|痛みなし)", "painless"),
            (r"(持続|期間)", "duration"),
            (r"(何ショット|ショット)", "shots"),
            (r"(目の下|くま)", "under-eye"),
            (r"(タッチプライム|認証|正品)", "verification"),
            (r"(ソフウェーブ|サーマクール|サーマジ|オリジオ|オンダ|オールタイト|ボルニューマ|vs|比較|違い)", "vs-alternative"),
            (r"(ダウンタイム|腫れ|赤み)", "recovery"),
            (r"(値段|料金|費用)", "cost-breakdown"),
            (r"(おすすめ|名医|選び方)", "best-choice"),
        ],
        "overview",
    )

    return "/ja/posts/" + "-".join([treatment_slug, main_topic, topic_detail, location_slug])


def translate_keyword_hint(keyword: str) -> str:
    replacements = [
        ("セイェクリニック", "세예클리닉"),
        ("セイエクリニック", "세예클리닉"),
        ("ウルセラプライム", "울쎄라프라임"),
        ("ウルセラ", "울쎄라"),
        ("リジュラン", "리쥬란"),
        ("糸リフト", "실리프팅"),
        ("サーマクール", "써마쿨"),
        ("サーマジ", "써마지"),
        ("オンダ", "온다"),
        ("オールタイト", "올타이트"),
        ("オリジオ", "올리지오"),
        ("ボルニューマ", "볼뉴머"),
        ("江南", "강남"),
        ("ソウル", "서울"),
        ("韓国", "한국"),
        ("料金", "가격"),
        ("値段", "가격"),
        ("おすすめ", "추천"),
        ("皮膚科", "피부과"),
        ("美容クリニック", "미용클리닉"),
    ]
    translated = keyword
    for source, target in replacements:
        translated = translated.replace(source, target)
    return translated
