# Why wrong facts get credit (phase 1c, task 2: report only)

Source: the five-run marking smoke of phase 1b (`docs/hw-eval/cost-phase1b.md`), smallrun-b@v1, profiles M0, M0-single, M1 and M1-medium.
Every `wrong_fact` item in the set (7) was credited by at least one profile. No prompt, rubric or profile was changed in this task. The
classification below is mine, by reading each item once: seven items is a small sample, and the line between (a) and (b) is a judgement call
(noted where it bites).

Classes:
- **(a)** the rubric point names the topic but not the fact, so a wrong fact still "covers" it;
- **(b)** the expected mark depends on the undecided partial-credit rule ("right idea, wrong detail": part of the answer is right);
- **(c)** the fact is in the rubric and the grader credited the wrong one anyway (nothing in the answer is right);
- **(d)** the mutation itself is wrong or ambiguous.

## The seven items

| # | What the mutation did | Class | Why | Runs credited, of 5: M0 / M0-single / M1 / M1-medium |
|---|---|---|---|---|
| 1 | "door closed, little sunlight" → "door **open**, plenty of sunlight" | **(a)** | The point's "also accept" line is "Plant B was kept in a cupboard", which the mutated sentence satisfies word for word; the fact (closed door, less sunlight) is in the main wording but not in the alternative. (Could be argued (b): the cupboard part is right.) | 1 / 2 / 4 / 1 |
| 2 | "watered once a week, less water" → "watered **every morning**, **more** water" | **(c)** | The point states the fact and the answer states its opposite; no part is right. | 0 / 0 / 4 / 1 |
| 3 | "carbon dioxide" → "**oxygen**" | **(c)** | A one-word fact in the rubric, replaced by the wrong gas. | 0 / 0 / 2 / 1 |
| 4 | "twice a day, tests it, sells to a dairy in town, fair price every ten days" → "once a week, weighs it, government depot, fixed price every month" | **(b)** | A compound point; the answer keeps the idea (the cooperative collects and sells milk) with every detail changed. Graders gave 0.5. | 0 / 0 / 5 / 5 |
| 5 | "cattle feed at a lower cost, free monthly camp" → "feed at a **higher price**, **paid yearly** camp" | **(b)** | The idea (feed, a health camp) is right; the cost and frequency are wrong. Graders gave 0.5. | 0 / 0 / 3 / 4 |
| 6 | (Hindi) "drinking-water shortage ended, wells kept water" → "shortage **grew**, wells **dried**" | **(c)** | The opposite of the point; nothing in it is right. | 0 / 0 / 0 / 1 |
| 7 | (Hindi) pond water irrigated **wheat** → irrigated **rice** | **(b)** | "Pond water let farmers irrigate a crop" is right; the crop is wrong. This is the paddy-for-wheat case of phase 1's finding 3. | 3 / 4 / 5 / 5 |

(d): none. Each mutated sentence changes the facts it says it changes, and the expected mark of 0 for the point is what the mutation rule says. Items 4, 5
and 7 are where a teacher could reasonably disagree with 0, which is exactly the point of class (b).

## Counts of missed points (point-runs credited above the expected mark, out of 35 per profile)

| Class | M0 | M0-single | M1 | M1-medium |
|---|---|---|---|---|
| (a) rubric names the topic, not the fact | 1 | 2 | 4 | 1 |
| (b) depends on the undecided partial-credit rule | 3 | 4 | 13 | 14 |
| (c) fact in the rubric, wrong one credited | 0 | 0 | 6 | 3 |
| (d) the mutation is wrong or ambiguous | 0 | 0 | 0 | 0 |
| **Total** | **4** | **6** | **23** | **18** |

These totals are the misses behind the detection figures of phase 1b (M0 66/70, M0-single 64/70, M1 47/70, M1-medium 52/70).

What this says:

- **M0's four misses are (a) and (b) only**: it never credits an outright reversed fact (class (c)). Its remaining gap is the partial-credit question
  (3 of 4) and one rubric alternative that names only the topic (1 of 4). The partial-credit rule can fix most of M0's gap without touching the model.
- **The gpt-6-luna profiles lose in two different ways.** 57–78% of their misses are class (b), the same partial-credit gap as M0 but far more often (it
  gives 0.5 for a right idea with a wrong detail almost whenever the idea matches); and 3–6 misses are class (c), which M0 does not make: crediting
  the opposite of the fact, or the wrong gas.
- **Class (a) is a rubric fault, not a grader fault.** An "also accept" wording that names an object without the fact lets a wrong answer through for any
  grader that follows it. That is something a person fixes in the key, not something a prompt can fix.
- **Expected marks need the rule.** For items 4, 5 and 7 the expected 0 is a choice. Until two subject teachers set the rule (pilot step 0.6) any detection
  figure on `wrong_fact` mixes grader error with a disagreement about the answer key.

## The strict profile of task 3, from these classes

- (b) and (c): the grader decides only "same fact, different fact, or absent". Any mismatch in a specific the point gives is "different fact": there is no
  half. This takes a side on the undecided rule for the purpose of a trial, and says so.
- (a): the prompt says an "also accept" wording is another way to say the same fact and never lowers the standard.
- The model returns no marks. Code computes them from the verdicts and the rubric, so a model's arithmetic or leniency cannot add a half.

The per-item detail follows: the question, passage, model answer, key point, original and mutated answer, and for each profile how many runs credited the
point, the marks per run, and the evidence the grader quoted.

---

7 wrong_fact items; profiles M0, M0-single, M1, M1-medium
### Item 1: igo2y4n7 (case_based, 3 marks, en)
- Question: From the passage, give two reasons why plant B grew less than plant A, and name the gas that plants take in to make their food.
- Passage: Ravi's class grew two bean plants for three weeks. Plant A was kept near the window, where it got sunlight for most of the day, and it was watered every morning. Plant B was kept in a cupboard with the door closed and was watered only once a week. At the end, plant A was tall with large green leaves, while plant B was short, with pale yellow leaves. The teacher explained that green plants make their own food in their leaves using sunlight, water and carbon dioxide taken from the air, and that they give out oxygen while doing so.
- Model answer: Plant B grew less than plant A because: 1. It was kept in a cupboard with the door closed, so it lacked sufficient sunlight compared to plant A. 2. It was watered only once a week, whereas plant A was watered every morning.  The gas that plants take in from the air to make their food is carbon dioxide.
- Key point p1 (1 mark): Plant B was kept in a cupboard with the door closed (got no/less sunlight compared to Plant A near the window). [also accept: Plant B was kept in a cupboard / lacked sunlight]  → expected 0
- Original answer: Plant B was kept in a cupboard with the door closed, so it got little or no sunlight unlike Plant A which was near the window. Plant B was watered only once a week, so it got less water than Plant A which was watered every morning. Plants take in carbon dioxide from the air to make their food by photosynthesis.
- Mutated sentence(s): Plant B was kept in a cupboard with the door open, so it got plenty of sunlight unlike Plant A which was near the window.
- Full mutated answer: Plant B was kept in a cupboard with the door open, so it got plenty of sunlight unlike Plant A which was near the window. Plant B was watered only once a week, so it got less water than Plant A which was watered every morning. Plants take in carbon dioxide from the air to make their food by photosynthesis.
  - M0         point p1: credited in 1 of 5 runs (marks per run 0/0/0.5/0/0); evidence quoted: "Plant B was kept in a cupboard with the door open"
  - M0-single  point p1: credited in 2 of 5 runs (marks per run 0/0/0.5/0/0.5); evidence quoted: "Plant B was kept in a cupboard with the door open"
  - M1         point p1: credited in 4 of 5 runs (marks per run 0.5/0.5/0.5/0/0.5); evidence quoted: "kept in a cupboard with the door open" | "Plant B was kept in a cupboard with the door open, so it got plenty of sunlight unlike Plant A which was near the window."
  - M1-medium  point p1: credited in 1 of 5 runs (marks per run 0/0/0/0.5/0); evidence quoted: "Plant B was kept in a cupboard with the door open, so it got plenty of sunlight"
### Item 2: 54mdxim3 (case_based, 3 marks, en)
- Question: From the passage, give two reasons why plant B grew less than plant A, and name the gas that plants take in to make their food.
- Passage: Ravi's class grew two bean plants for three weeks. Plant A was kept near the window, where it got sunlight for most of the day, and it was watered every morning. Plant B was kept in a cupboard with the door closed and was watered only once a week. At the end, plant A was tall with large green leaves, while plant B was short, with pale yellow leaves. The teacher explained that green plants make their own food in their leaves using sunlight, water and carbon dioxide taken from the air, and that they give out oxygen while doing so.
- Model answer: Plant B grew less than plant A because: 1. It was kept in a cupboard with the door closed, so it lacked sufficient sunlight compared to plant A. 2. It was watered only once a week, whereas plant A was watered every morning.  The gas that plants take in from the air to make their food is carbon dioxide.
- Key point p2 (1 mark): Plant B was watered only once a week (received less water compared to Plant A watered every morning). [also accept: Plant B was watered only once a week / received less water]  → expected 0
- Original answer: Plant B was kept in a cupboard with the door closed, so it got little or no sunlight unlike Plant A which was near the window. Plant B was watered only once a week, so it got less water than Plant A which was watered every morning. Plants take in carbon dioxide from the air to make their food by photosynthesis.
- Mutated sentence(s): Plant B was watered every morning, so it got more water than Plant A which was watered only once a week.
- Full mutated answer: Plant B was kept in a cupboard with the door closed, so it got little or no sunlight unlike Plant A which was near the window. Plant B was watered every morning, so it got more water than Plant A which was watered only once a week. Plants take in carbon dioxide from the air to make their food by photosynthesis.
  - M0         point p2: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M0-single  point p2: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M1         point p2: credited in 4 of 5 runs (marks per run 0/0.5/0.5/0.5/0.5); evidence quoted: "Plant B was watered every morning, so it got more water than Plant A which was watered only once a week."
  - M1-medium  point p2: credited in 1 of 5 runs (marks per run 0/0.5/0/0/0); evidence quoted: "Plant B was watered every morning, so it got more water than Plant A which was watered only once a week."
### Item 3: dvyzc5ld (case_based, 3 marks, en)
- Question: From the passage, give two reasons why plant B grew less than plant A, and name the gas that plants take in to make their food.
- Passage: Ravi's class grew two bean plants for three weeks. Plant A was kept near the window, where it got sunlight for most of the day, and it was watered every morning. Plant B was kept in a cupboard with the door closed and was watered only once a week. At the end, plant A was tall with large green leaves, while plant B was short, with pale yellow leaves. The teacher explained that green plants make their own food in their leaves using sunlight, water and carbon dioxide taken from the air, and that they give out oxygen while doing so.
- Model answer: Plant B grew less than plant A because: 1. It was kept in a cupboard with the door closed, so it lacked sufficient sunlight compared to plant A. 2. It was watered only once a week, whereas plant A was watered every morning.  The gas that plants take in from the air to make their food is carbon dioxide.
- Key point p3 (1 mark): Plants take in carbon dioxide to make their food. [also accept: Carbon dioxide; CO2]  → expected 0
- Original answer: Plant B was kept in a cupboard with the door closed, so it got little or no sunlight unlike Plant A which was near the window. Plant B was watered only once a week, so it got less water than Plant A which was watered every morning. Plants take in carbon dioxide from the air to make their food by photosynthesis.
- Mutated sentence(s): Plants take in oxygen from the air to make their food by photosynthesis.
- Full mutated answer: Plant B was kept in a cupboard with the door closed, so it got little or no sunlight unlike Plant A which was near the window. Plant B was watered only once a week, so it got less water than Plant A which was watered every morning. Plants take in oxygen from the air to make their food by photosynthesis.
  - M0         point p3: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M0-single  point p3: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M1         point p3: credited in 2 of 5 runs (marks per run 0.5/0/0/0.5/0); evidence quoted: "Plants take in oxygen from the air to make their food"
  - M1-medium  point p3: credited in 1 of 5 runs (marks per run 0/0.5/0/0/0); evidence quoted: "Plants take in oxygen from the air to make their food"
### Item 4: awssadzb (source_based, 2 marks, en)
- Question: How did the dairy cooperative help the small farmers of Ramgarh? Give two ways mentioned in the source.
- Passage: Before 2015, the small farmers of Ramgarh sold their milk to a trader who paid a low price and often paid late. In 2015, forty families formed a dairy cooperative. The cooperative collects milk from every member twice a day, tests it, and sells it directly to a dairy in the town, so members now get a fair price paid every ten days. It also gives members cattle feed at a lower cost and runs a free animal health camp every month.
- Model answer: The dairy cooperative helped the small farmers of Ramgarh in the following two ways: 1. It collects milk directly, tests it, and sells it to a town dairy, ensuring members get a fair price paid every ten days instead of low and delayed payments. 2. It provides cattle feed to its members at a lower cost and runs a free animal health camp every month.
- Key point p1 (1 mark): It collects milk twice a day, tests it, and sells it directly to a dairy in town, ensuring members get a fair price paid every ten days. [also accept: Ensured fair price and timely payment (every ten days) for milk sold directly to town dairy.]  → expected 0
- Original answer: The cooperative collects milk from members twice a day, tests its quality, and sells it directly to a dairy in town, so farmers get a fair price paid every ten days. It provides members with cattle feed at a lower cost and also runs a free monthly animal health camp for their cattle.
- Mutated sentence(s): The cooperative collects milk from members once a week, weighs it at the collection centre, and sells it to a government depot in the district capital, so farmers get a fixed price paid every month.
- Full mutated answer: The cooperative collects milk from members once a week, weighs it at the collection centre, and sells it to a government depot in the district capital, so farmers get a fixed price paid every month. It provides members with cattle feed at a lower cost and also runs a free monthly animal health camp for their cattle.
  - M0         point p1: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M0-single  point p1: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M1         point p1: credited in 5 of 5 runs (marks per run 0.5/0.5/0.5/0.5/0.5); evidence quoted: "The cooperative collects milk from members once a week, weighs it at the collection centre, and sells it to a government depot in the district capital, so farmers get a fixed price paid every month." | "collects milk from members once a week, weighs it at the collection centre, and sells it to a government depot in the district capital"
  - M1-medium  point p1: credited in 5 of 5 runs (marks per run 0.5/0.5/0.5/0.5/0.5); evidence quoted: "The cooperative collects milk from members once a week, weighs it at the collection centre, and sells it to a government depot in the district capital, so farmers get a fixed price paid every month." | "The cooperative collects milk from members once a week, weighs it at the collection centre, and sells it to a government depot in the district capital"
### Item 5: 4wchdr54 (source_based, 2 marks, en)
- Question: How did the dairy cooperative help the small farmers of Ramgarh? Give two ways mentioned in the source.
- Passage: Before 2015, the small farmers of Ramgarh sold their milk to a trader who paid a low price and often paid late. In 2015, forty families formed a dairy cooperative. The cooperative collects milk from every member twice a day, tests it, and sells it directly to a dairy in the town, so members now get a fair price paid every ten days. It also gives members cattle feed at a lower cost and runs a free animal health camp every month.
- Model answer: The dairy cooperative helped the small farmers of Ramgarh in the following two ways: 1. It collects milk directly, tests it, and sells it to a town dairy, ensuring members get a fair price paid every ten days instead of low and delayed payments. 2. It provides cattle feed to its members at a lower cost and runs a free animal health camp every month.
- Key point p2 (1 mark): It provides members with cattle feed at a lower cost and/or runs a free monthly animal health camp. [also accept: Gives cattle feed at a lower cost.; Organizes free monthly animal health camps.]  → expected 0
- Original answer: The cooperative collects milk from members twice a day, tests its quality, and sells it directly to a dairy in town, so farmers get a fair price paid every ten days. It provides members with cattle feed at a lower cost and also runs a free monthly animal health camp for their cattle.
- Mutated sentence(s): It provides members with cattle feed at a higher price and also runs a paid yearly animal health camp for their cattle.
- Full mutated answer: The cooperative collects milk from members twice a day, tests its quality, and sells it directly to a dairy in town, so farmers get a fair price paid every ten days. It provides members with cattle feed at a higher price and also runs a paid yearly animal health camp for their cattle.
  - M0         point p2: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M0-single  point p2: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M1         point p2: credited in 3 of 5 runs (marks per run 0.5/0/0.5/0.5/0); evidence quoted: "It provides members with cattle feed at a higher price and also runs a paid yearly animal health camp" | "It provides members with cattle feed at a higher price and also runs a paid yearly animal health camp for their cattle."
  - M1-medium  point p2: credited in 4 of 5 runs (marks per run 0.5/0.5/0.5/0/0.5); evidence quoted: "cattle feed at a higher price and also runs a paid yearly animal health camp" | "It provides members with cattle feed at a higher price and also runs a paid yearly animal health camp for their cattle."
### Item 6: 3ryiuqup (source_based, 2 marks, hi)
- Question: स्रोत के अनुसार, गाँव में वर्षा जल संचयन से कौन-से दो लाभ हुए?
- Passage: राजपुर गाँव में गर्मियों में कुएँ सूख जाते थे और महिलाओं को पानी लाने के लिए दो किलोमीटर दूर जाना पड़ता था। 2019 में गाँव वालों ने मिलकर घरों की छतों से वर्षा का पानी इकट्ठा करने के लिए टांके बनाए और गाँव के तालाब को गहरा किया। अगली गर्मियों में कुओं में पानी बना रहा, जिससे पीने के पानी की कमी दूर हो गई। तालाब में पानी रहने से किसान गेहूँ की फसल की सिंचाई भी कर सके।
- Model answer: स्रोत के अनुसार, गाँव में वर्षा जल संचयन से निम्नलिखित दो लाभ हुए: 1. कुओं में पानी बना रहा, जिससे पीने के पानी की कमी दूर हो गई। 2. तालाब में पानी रहने से किसान गेहूँ की फसल की सिंचाई कर सके।
- Key point p1 (1 mark): पीने के पानी की कमी दूर हो गई (कुओं में पानी बना रहा)। [also accept: कुओं में पानी बना रहा; पीने के पानी की समस्या समाप्त हो गई]  → expected 0
- Original answer: पीने के पानी की कमी दूर हो गई, क्योंकि कुओं में पानी बना रहा। तालाब में पानी रहने से किसान गेहूँ की फसल की सिंचाई कर सके।
- Mutated sentence(s): पीने के पानी की कमी और बढ़ गई, क्योंकि कुओं का पानी सूख गया।
- Full mutated answer: पीने के पानी की कमी और बढ़ गई, क्योंकि कुओं का पानी सूख गया। तालाब में पानी रहने से किसान गेहूँ की फसल की सिंचाई कर सके।
  - M0         point p1: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M0-single  point p1: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M1         point p1: credited in 0 of 5 runs (marks per run 0/0/0/0/0); evidence quoted: (none)
  - M1-medium  point p1: credited in 1 of 5 runs (marks per run 0/0.5/0/0/0); evidence quoted: "पीने के पानी की कमी और बढ़ गई, क्योंकि कुओं का पानी सूख गया।"
### Item 7: jlqqcqcg (source_based, 2 marks, hi)
- Question: स्रोत के अनुसार, गाँव में वर्षा जल संचयन से कौन-से दो लाभ हुए?
- Passage: राजपुर गाँव में गर्मियों में कुएँ सूख जाते थे और महिलाओं को पानी लाने के लिए दो किलोमीटर दूर जाना पड़ता था। 2019 में गाँव वालों ने मिलकर घरों की छतों से वर्षा का पानी इकट्ठा करने के लिए टांके बनाए और गाँव के तालाब को गहरा किया। अगली गर्मियों में कुओं में पानी बना रहा, जिससे पीने के पानी की कमी दूर हो गई। तालाब में पानी रहने से किसान गेहूँ की फसल की सिंचाई भी कर सके।
- Model answer: स्रोत के अनुसार, गाँव में वर्षा जल संचयन से निम्नलिखित दो लाभ हुए: 1. कुओं में पानी बना रहा, जिससे पीने के पानी की कमी दूर हो गई। 2. तालाब में पानी रहने से किसान गेहूँ की फसल की सिंचाई कर सके।
- Key point p2 (1 mark): किसान गेहूँ की फसल की सिंचाई कर सके (तालाब में पानी रहने से)। [also accept: गेहूँ की फसल की सिंचाई के लिए पानी उपलब्ध हुआ; तालाब के पानी से गेहूँ की सिंचाई संभव हुई]  → expected 0
- Original answer: पीने के पानी की कमी दूर हो गई, क्योंकि कुओं में पानी बना रहा। तालाब में पानी रहने से किसान गेहूँ की फसल की सिंचाई कर सके।
- Mutated sentence(s): तालाब में पानी रहने से किसान धान की फसल की सिंचाई कर सके।
- Full mutated answer: पीने के पानी की कमी दूर हो गई, क्योंकि कुओं में पानी बना रहा। तालाब में पानी रहने से किसान धान की फसल की सिंचाई कर सके।
  - M0         point p2: credited in 3 of 5 runs (marks per run 0/0.5/0.5/0/0.5); evidence quoted: "किसान धान की फसल की सिंचाई कर सके" | "तालाब में पानी रहने से किसान धान की फसल की सिंचाई कर सके।"
  - M0-single  point p2: credited in 4 of 5 runs (marks per run 0.5/0.5/0/0.5/0.5); evidence quoted: "किसान धान की फसल की सिंचाई कर सके।" | "किसान धान की फसल की सिंचाई कर सके"
  - M1         point p2: credited in 5 of 5 runs (marks per run 0.5/0.5/0.5/0.5/0.5); evidence quoted: "तालाब में पानी रहने से किसान धान की फसल की सिंचाई कर सके।"
  - M1-medium  point p2: credited in 5 of 5 runs (marks per run 0.5/0.5/0.5/0.5/0.5); evidence quoted: "तालाब में पानी रहने से किसान धान की फसल की सिंचाई कर सके।" | "तालाब में पानी रहने से किसान धान की फसल की सिंचाई कर सके"
7 of 7 wrong_fact items were credited by at least one profile.
