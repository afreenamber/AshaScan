MODIFY THE EXISTING ASHASCAN DESIGN — DO NOT REDESIGN IT FROM SCRATCH.

IMPORTANT:
The current generated screens are appearing inside a partial-width layout and are not using the full available mobile screen. Rework the screen layouts so that every app screen occupies the COMPLETE mobile viewport from edge to edge.

DESIGN FRAME:
- Design for a real Flutter mobile application.
- Use a full mobile viewport, preferably 390 × 844 px.
- Every screen should extend from the top edge to the bottom edge of the phone frame.
- Do NOT place the UI inside a smaller centered card or 3/4-width container.
- Do NOT create large empty margins around the application.
- The actual app content should use approximately 90–94% of the available screen width while maintaining comfortable side padding.
- Use 16–20 px horizontal margins.
- Bottom navigation should span the full width.
- Primary buttons should be wide and easy to tap.
- Make all screens visually consistent as one real mobile application.

IMPORTANT USER:
The primary users are ASHA workers working in communities.

Do NOT describe them as “uneducated”.
Design instead for users with LOW DIGITAL LITERACY, limited time, and potentially difficult field conditions.

The application must be understandable without requiring the user to read long instructions.

CORE UX PRINCIPLE:
“SEE → TAP → UNDERSTAND → ACT”

Avoid complicated menus, dense forms, technical terminology and unnecessary information.

-----------------------------------
LANGUAGE SWITCH
-----------------------------------

Add a highly visible language switch option throughout the app.

Languages:
EN | हिंदी

Place the language selector:
- On the Login screen near the top/right.
- On the Profile/Settings screen.
- Make it accessible without navigating through complicated settings.

The selected language should conceptually change all major interface labels.

Use short, simple wording.

Examples:

English:
“Start Screening”
Hindi:
“जांच शुरू करें”

English:
“Patient Details”
Hindi:
“मरीज़ की जानकारी”

English:
“Continue”
Hindi:
“आगे बढ़ें”

English:
“Screening Result”
Hindi:
“जांच का परिणाम”

English:
“Refer to Health Centre”
Hindi:
“स्वास्थ्य केंद्र भेजें”

English:
“Save”
Hindi:
“सेव करें”

Do not translate technical AI/model terminology because the user does not need to see it.

-----------------------------------
SIMPLIFY THE ENTIRE UI
-----------------------------------

Reduce the amount of text on every screen.

Use:
- Large headings
- Large buttons
- Simple icons
- Visual selection cards
- Checkboxes
- Yes/No buttons
- Simple progress indicators
- Large risk indicators

Avoid:
- Long paragraphs
- Dense tables
- Tiny labels
- Multiple competing buttons
- Excessive cards
- Complex charts
- Technical terminology
- Decorative AI graphics that don't improve usability

Every screen must have ONE clearly dominant action.

The user should immediately know:
1. Where am I?
2. What do I need to do?
3. What do I tap next?

-----------------------------------
REFLECT THE ACTUAL ASHASCAN TECH STACK
-----------------------------------

The UI should visually support the actual system architecture:

Flutter:
The application is a mobile-first Flutter app.

Firebase Authentication:
Use a simple secure login screen with ASHA Worker ID/mobile number and OTP-style authentication.

OpenCV + MediaPipe:
The screening flow includes camera-based image quality checking.

Create the capture screen with simple visual guidance:
- Show a camera preview.
- A clear rectangular/rounded face/eye positioning guide where appropriate.
- Large green check indicators for:
  “Good lighting”
  “Image clear”
  “Correct position”
- If quality is poor, show one simple instruction:
  “Move to better light”
  or
  “Take photo again”

Do NOT expose the words OpenCV or MediaPipe to the ASHA worker.

TensorFlow Lite:
The AI screening runs on-device.

During analysis, communicate simply:
“Checking results…”

Do NOT display:
“TensorFlow Lite”
“CNN”
“Model inference”
or other technical implementation details.

SQLite / Drift:
The app is offline-first.

This is VERY IMPORTANT.

Add a small but understandable offline/sync status indicator in the top bar.

Examples:
✓ Saved on phone
☁ Syncing
✓ Synced

If there is no internet:
“Saved on phone. Will sync when internet is available.”

Do not make the user worry about the database.

FastAPI + PostgreSQL:
When connectivity returns, records can synchronize with the backend.

Show synchronization as a simple visual state rather than exposing backend/database terminology.

-----------------------------------
HOME SCREEN
-----------------------------------

Make the dashboard extremely simple.

Top:
AshaScan logo
ASHA worker name
Small language switch: EN | हिंदी

Show connection status subtly:
“✓ Synced”
or
“Offline — saved on phone”

Main focus:

“Ready to screen?”

Large primary button:

+ START SCREENING

Below, show only three simple statistics:

TODAY
12 Screened

3 Follow-ups

1 High Risk

Then:

“Recent screenings”

Show 3–4 patients maximum.

Each item should contain:
Name / ID
Time
Risk status

Avoid complicated analytics.

-----------------------------------
SCREENING FLOW
-----------------------------------

Make the screening process feel like a guided 3-step process.

At the top:
STEP 1 OF 3
STEP 2 OF 3
STEP 3 OF 3

Use a simple progress bar.

STEP 1:
“Patient information”

Only essential fields.

Prefer:
Age selector
Sex selection
Simple name field

Avoid asking for unnecessary information at this stage.

STEP 2:
“Take a photo”

Show camera preview and very clear positioning instructions.

Example:
“Place the eye inside the box”

Then image-quality feedback:

✓ Clear image
✓ Good light

If unsuccessful:

“Photo not clear”
“Try again”

Large button:
RETAKE PHOTO

STEP 3:
“Checking…”

Show a simple calm analysis state.

Text:
“Checking screening result…”

Secondary:
“You can continue when the result is ready.”

Do not show technical AI/model terminology.

-----------------------------------
RESULT SCREEN — HIGHEST PRIORITY
-----------------------------------

Make this screen extremely easy to understand.

Top:
SCREENING RESULT

Then a VERY LARGE risk indicator.

GREEN:
LOW RISK

YELLOW:
POSSIBLE RISK

RED:
HIGH RISK

Do not use complex numerical scores as the primary information.

If a risk score exists technically, it can appear as secondary information, but the ASHA worker should primarily see the risk category.

IMPORTANT:
Never present the result as a diagnosis.

Use:
“Possible anemia risk”
NOT:
“You have anemia”

For Yellow:

“Possible anemia risk”

Then:

“What to do next”

Large CTA:
REFER FOR CHECK-UP

Secondary:
SAVE RESULT

For Red:

“HIGH RISK”

“Further check-up is needed.”

Primary CTA:
REFER TO HEALTH CENTRE

Secondary:
SCHEDULE FOLLOW-UP

For Green:

“LOW RISK”

“Continue healthy diet and routine care.”

-----------------------------------
DIETARY ADVICE
-----------------------------------

Keep advice visual.

Instead of paragraphs, use 3 large illustrated/simple icon cards:

IRON-RICH FOODS
“Palak, chana, rajma”

VITAMIN C
“Amla, citrus fruits”

HYDRATION & REST

Keep the language extremely simple.

-----------------------------------
FOLLOW-UP
-----------------------------------

Create a simple follow-up state.

Instead of complicated medical records, show:

Patient
Risk
Date
Next step
Follow-up status

Use clear statuses:

FOLLOW-UP DUE
FOLLOW-UP DONE

Use large visual indicators.

-----------------------------------
PATIENTS SCREEN
-----------------------------------

Do not create a complicated medical-record interface.

Use a simple list.

Each patient row:
Name
Age
Last screening
Risk color

Allow simple search.

Large touch targets.

-----------------------------------
OFFLINE-FIRST EXPERIENCE
-----------------------------------

This should be part of the product identity.

Add subtle offline status throughout the app.

Possible states:

ONLINE
✓ Synced

OFFLINE
⌁ Saved on phone

SYNCING
↻ Syncing…

SYNCED
✓ All records synced

Do not use alarming red warnings just because the internet is unavailable.

The user should understand:
“My work is safe even without internet.”

-----------------------------------
BOTTOM NAVIGATION
-----------------------------------

Use only:

Home
Patients
Follow-ups
Profile

Do not use 5–6 navigation items.

Use both icon + text.

Make the selected item visually obvious.

-----------------------------------
VISUAL STYLE
-----------------------------------

Keep the existing AshaScan visual identity but simplify it.

Use:
- Warm off-white background
- Deep teal/green primary color
- Soft pink/coral accent
- Dark navy/charcoal text
- Green / yellow / red risk states

Avoid:
- Excessive gradients
- Glassmorphism
- Neon
- Futuristic holographic AI visuals
- Generic hospital imagery
- Excessive illustrations
- Huge decorative graphics

The interface should feel:
TRUSTWORTHY + SIMPLE + HUMAN + FIELD-READY.

The product should look like it could genuinely be used by an ASHA worker in an Indian village or community health setting.

-----------------------------------
ACCESSIBILITY
-----------------------------------

Make accessibility a major design requirement.

- Minimum comfortable body text size around 16 px.
- Large buttons.
- Strong contrast.
- Large tap targets.
- Don't communicate risk using color alone.
- Pair risk colors with text:
  GREEN + LOW RISK
  YELLOW + POSSIBLE RISK
  RED + HIGH RISK
- Avoid tiny icons.
- Avoid placing important information only in tooltips.
- Use familiar visual symbols.

-----------------------------------
FIGMA FILE STRUCTURE
-----------------------------------

Keep the file lightweight because this is being created on the FREE FIGMA PLAN.

Do NOT generate:
- Huge design systems
- Hundreds of component variants
- Dozens of unnecessary screens
- Complex animations
- Premium assets
- Excessive documentation

Keep the essential screens:

1. Login
2. Home
3. Patient Details
4. Camera / Image Quality
5. Analysis
6. Result — Green
7. Result — Yellow
8. Result — Red
9. Follow-up
10. Patients
11. Profile / Language

Create only a small reusable component set:
- Primary button
- Secondary button
- Input
- Selection card
- Risk badge
- Patient row
- Bottom navigation
- Offline/sync indicator
- Language switch

FINAL REQUIREMENT:

The result should NOT look like a generic AI healthcare dashboard.

It should look like a purpose-built, mobile-first community health tool where an ASHA worker can complete a screening in a few minutes, even with limited digital literacy and unreliable internet.

Prioritize usability over decoration.
Prioritize clarity over information density.
Prioritize ACTION over analytics.