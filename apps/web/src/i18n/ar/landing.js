// Arabic for the "landing" area. Keys are the exact English text passed to t()/msg().
// Covers the landing page, sign-in/sign-up, profile, cart and checkout, and the shared layout.
export const messages = {
  // Landing page: header, hero and footer
  "Features": "المزايا",
  "How it works": "طريقة العمل",
  "Benefits": "الفوائد",
  "Who it's for": "لمن صُمّم",
  "About": "عن النظام",
  "Open workspace": "فتح مساحة العمل",
  "Get started": "ابدأ الآن",
  "BookSaw — library management for books, members, loans and branches": "BookSaw — إدارة المكتبات: الكتب والأعضاء والإعارات والفروع",
  "BookSaw brings the catalogue, circulation desk, members, inventory, branches, fines and reports of a library into one organized system, with a self-service portal for members.":
    "يجمع BookSaw فهرس المكتبة ومكتب الإعارة والأعضاء والمخزون والفروع والغرامات والتقارير في نظام واحد منظّم، مع بوابة خدمة ذاتية للأعضاء.",
  "Library management system": "نظام إدارة المكتبات",
  "Books, members, loans and branches — in one organized system.": "الكتب والأعضاء والإعارات والفروع — في نظام واحد منظّم.",
  "BookSaw runs the daily work of a library: cataloguing editions and copies, lending and returns at the desk, reservation queues, fines, stocktakes and purchasing — across every branch, with a portal where members manage their own loans.":
    "يدير BookSaw العمل اليومي للمكتبة: فهرسة الطبعات والنسخ، والإعارة والإرجاع على المكتب، وقوائم انتظار الحجوزات، والغرامات، والجرد، والمشتريات — في جميع الفروع، مع بوابة يدير فيها الأعضاء إعاراتهم بأنفسهم.",
  "Go to the catalogue": "الانتقال إلى الفهرس",
  "Explore features": "استكشف المزايا",
  "Already have an account?": "لديك حساب بالفعل؟",
  "or": "أو",
  "search the catalogue": "ابحث في الفهرس",
  "without one.": "دون حساب.",
  "Everything a library desk and back office need": "كل ما يحتاجه مكتب الإعارة والعمل الإداري في المكتبة",
  "Each module below is part of BookSaw today, enforced by the same permissions and rules on the server.":
    "كل وحدة أدناه جزء من BookSaw اليوم، وتخضع للصلاحيات والقواعد نفسها على الخادم.",
  "Online card payments and the natural-language catalogue assistant are optional: they are switched on when the library configures a payment provider or an AI provider.":
    "الدفع الإلكتروني بالبطاقة ومساعد الفهرس باللغة الطبيعية ميزتان اختياريتان: تُفعَّلان عندما تُعِدّ المكتبة مزوّد دفع أو مزوّد ذكاء اصطناعي.",
  "Built for the desk": "مصمّم لمكتب الإعارة",
  "Check out and return in two scans": "إعارة وإرجاع بمسحتين فقط",
  "Type or scan a member card and a barcode. BookSaw checks the membership, the member's limits and any blocking fines, and refuses to lend a copy that is already out or held for someone else.":
    "اكتب أو امسح بطاقة العضو والباركود. يتحقق BookSaw من العضوية وحدود العضو وأي غرامات مانعة، ويرفض إعارة نسخة معارة بالفعل أو محجوزة لشخص آخر.",
  "Returned copies go straight to the next reservation, back home, or to the shelf.": "تذهب النسخ المُرجَعة مباشرةً إلى الحجز التالي، أو إلى فرعها الأصلي، أو إلى الرف.",
  "Overdue fines are calculated from your policy at the moment of return.": "تُحسب غرامات التأخير وفق سياستك لحظة الإرجاع.",
  "Exceptions need a reason, and every one is written to the audit log.": "تتطلب الاستثناءات ذكر السبب، ويُسجَّل كل استثناء في سجل التدقيق.",
  "From set-up to daily routine in four steps": "من الإعداد إلى العمل اليومي في أربع خطوات",
  "Less paperwork, clearer decisions": "أوراق أقل، وقرارات أوضح",
  "For libraries of different shapes and sizes": "لمكتبات بمختلف الأنواع والأحجام",
  "What fits depends on your policies — membership types, fines and permissions are configured by each library, not built in.":
    "ما يناسبك يعتمد على سياساتك — فأنواع العضوية والغرامات والصلاحيات تضبطها كل مكتبة بنفسها، وليست مفروضة مسبقًا.",
  "BookSaw started as an online bookstore and grew into a complete library system. The shop still works: titles marked for sale can be bought, while every title can be borrowed and reserved.":
    "بدأ BookSaw متجرًا إلكترونيًا للكتب ثم تطوّر إلى نظام مكتبات متكامل. وما زال المتجر يعمل: يمكن شراء العناوين المعروضة للبيع، بينما يمكن استعارة أي عنوان وحجزه.",
  "Create an account": "إنشاء حساب",
  "Browse the catalogue": "تصفّح الفهرس",
  "A library management system for catalogue, circulation, members and branches.": "نظام لإدارة المكتبات يشمل الفهرس والإعارة والأعضاء والفروع.",
  "Product": "المنتج",
  "Account": "الحساب",

  // Landing page: features, benefits, steps, audiences
  "Editions with validated ISBNs, authors, publishers, subjects and categories. Full-text search with filters and live availability per branch.":
    "طبعات بأرقام ISBN موثّقة، ومؤلفون وناشرون وموضوعات وتصنيفات. بحث في النص الكامل مع عوامل تصفية وتوفّر مباشر في كل فرع.",
  "Check out and return by barcode, renew, record damage or loss. Loan limits and periods come from each membership type.":
    "إعارة وإرجاع بالباركود، وتجديد، وتسجيل التلف أو الفقد. حدود الإعارة ومددها مأخوذة من نوع كل عضوية.",
  "Queues per title with holds at the member's pickup branch, automatic hand-over of returned copies and pickup deadlines.":
    "قوائم انتظار لكل عنوان مع حجز النسخ في فرع الاستلام الذي يختاره العضو، وتسليم تلقائي للنسخ المُرجَعة، ومواعيد نهائية للاستلام.",
  "Individuals, students, researchers and institutions. Registration, renewal, suspension and a full membership history.":
    "أفراد وطلاب وباحثون ومؤسسات. تسجيل وتجديد وإيقاف، وسجل كامل للعضوية.",
  "Inventory & acquisitions": "المخزون والمقتنيات",
  "Copies with barcodes, shelves and condition. Stocktakes, audited adjustments, suppliers, purchase orders and deliveries.":
    "نسخ بباركود ورفوف وحالة. جرد، وتسويات خاضعة للتدقيق، وموردون، وأوامر شراء، وعمليات تسليم.",
  "Multiple branches": "فروع متعددة",
  "Branches, rooms and shelves, transfers with history, and staff whose access is limited to their own branches.":
    "فروع وقاعات ورفوف، وعمليات نقل مع سجلها، وموظفون تقتصر صلاحياتهم على فروعهم.",
  "Fines from your own policy, cash payments with receipts, refunds and waivers. Optional online card payments.":
    "غرامات وفق سياستك، ومدفوعات نقدية بإيصالات، واستردادات وإعفاءات. ودفع إلكتروني اختياري بالبطاقة.",
  "Most and least borrowed titles, overdue loans, fines, memberships, reservations, acquisitions and branch comparisons, with CSV export.":
    "العناوين الأكثر والأقل استعارة، والإعارات المتأخرة، والغرامات، والعضويات، والحجوزات، والمقتنيات، ومقارنات الفروع، مع التصدير إلى CSV.",
  "Due-soon and overdue reminders, reservation and membership notices — in the member's inbox and by email, never sent twice.":
    "تذكيرات بقرب موعد الإرجاع وبالتأخير، وإشعارات الحجوزات والعضوية — في صندوق العضو وعبر البريد الإلكتروني، دون تكرار.",
  "Publications in private storage, opened only by members whose membership and the item's licence allow it.":
    "منشورات في مساحة تخزين خاصة، لا يفتحها إلا الأعضاء الذين تسمح بذلك عضويتهم ورخصة المادة.",
  "Bookable study rooms without double bookings, and events with registration up to capacity.":
    "قاعات مذاكرة قابلة للحجز دون تعارض في الحجوزات، وفعاليات بتسجيل حتى اكتمال السعة.",
  "Roles & audit log": "الأدوار وسجل التدقيق",
  "Granular permissions per role, branch scope, and a record of every sensitive change: who, what, when and why.":
    "صلاحيات دقيقة لكل دور، ونطاق حسب الفرع، وسجل لكل تغيير حساس: من، وماذا، ومتى، ولماذا.",
  "A faster desk": "مكتب إعارة أسرع",
  "Scan a card and a barcode; the system applies the member's limits, holds and fines, so staff don't have to.":
    "امسح البطاقة والباركود؛ ويطبّق النظام حدود العضو وحجوزاته وغراماته، فلا يضطر الموظفون إلى ذلك.",
  "Overdue loans in plain sight": "الإعارات المتأخرة واضحة للعيان",
  "Overdue counts on the dashboard, an overdue report you can export, and reminders that go out on their own.":
    "أعداد المتأخرات على لوحة التحكم، وتقرير متأخرات قابل للتصدير، وتذكيرات تُرسَل تلقائيًا.",
  "One system for every branch": "نظام واحد لجميع الفروع",
  "Availability per branch, transfers between them and pickup anywhere — without separate spreadsheets.":
    "التوفّر في كل فرع، والنقل بين الفروع، والاستلام من أي مكان — دون جداول بيانات منفصلة.",
  "Inventory you can trust": "مخزون يمكنك الوثوق به",
  "Every copy has a status, and every change has a reason in the audit log. Stocktakes reconcile the shelves with the records.":
    "لكل نسخة حالة، ولكل تغيير سبب في سجل التدقيق. ويطابق الجرد بين الرفوف والسجلات.",
  "Reports that answer real questions": "تقارير تجيب عن أسئلة حقيقية",
  "What circulates, what doesn't, what is owed and what was bought — filtered by period and branch.":
    "ما يُعار وما لا يُعار، وما هو مستحق وما تم شراؤه — مصفّى حسب الفترة والفرع.",
  "Less manual work": "عمل يدوي أقل",
  "Members renew, reserve, pay and book rooms themselves; the system notifies them when something needs their attention.":
    "يجدّد الأعضاء ويحجزون ويدفعون ويحجزون القاعات بأنفسهم؛ ويُشعرهم النظام عندما يستدعي أمرٌ ما انتباههم.",
  "Set up your library": "أعِدّ مكتبتك",
  "Create branches, rooms and shelves, define membership types and your borrowing, fine and reservation policies.":
    "أنشئ الفروع والقاعات والرفوف، وحدّد أنواع العضوية وسياسات الإعارة والغرامات والحجز.",
  "Add books and members": "أضف الكتب والأعضاء",
  "Catalogue editions, add copies with barcodes or receive them from purchase orders, and register members.":
    "فهرِس الطبعات، وأضف النسخ بالباركود أو استلمها من أوامر الشراء، وسجّل الأعضاء.",
  "Run the desk": "أدِر مكتب الإعارة",
  "Lend, return, renew and manage reservations. Members follow their loans and holds in their own portal.":
    "أعِر وأرجِع وجدّد وأدِر الحجوزات. ويتابع الأعضاء إعاراتهم وحجوزاتهم في بوابتهم الخاصة.",
  "Review and improve": "راجِع وحسّن",
  "Watch overdue loans and fines, compare branches, export reports and check the audit log.":
    "تابِع الإعارات المتأخرة والغرامات، وقارن بين الفروع، وصدّر التقارير، وراجع سجل التدقيق.",
  "Public libraries": "المكتبات العامة",
  "Open catalogue, member self-service, reservations with branch pickup, events and room bookings.":
    "فهرس مفتوح، وخدمة ذاتية للأعضاء، وحجوزات مع الاستلام من الفرع، وفعاليات، وحجز قاعات.",
  "School & university libraries": "مكتبات المدارس والجامعات",
  "Student and researcher membership types with their own limits, plus a digital library restricted to members.":
    "أنواع عضوية للطلاب والباحثين بحدود خاصة بكل منها، إضافة إلى مكتبة رقمية مقصورة على الأعضاء.",
  "Private & special libraries": "المكتبات الخاصة والمتخصصة",
  "A single branch works just as well, and staff roles can be limited to the modules you actually use.":
    "يعمل النظام بالكفاءة نفسها مع فرع واحد، ويمكن قصر أدوار الموظفين على الوحدات التي تستخدمها فعلًا.",
  "Multi-branch organizations": "المؤسسات متعددة الفروع",
  "Branch-scoped staff roles, transfers, cross-branch pickup and side-by-side branch reports.":
    "أدوار موظفين محددة النطاق بالفرع، وعمليات نقل، واستلام من فرع آخر، وتقارير مقارنة بين الفروع.",

  // Landing page: product preview (sample data)
  "Illustration of the BookSaw staff workspace with sample data": "رسم توضيحي لمساحة عمل الموظفين في BookSaw ببيانات نموذجية",
  "Illustration with sample data — not live figures.": "رسم توضيحي ببيانات نموذجية — ليست أرقامًا حقيقية.",
  "Shelved": "أُعيد إلى الرف",
  "Checked out": "مُعار",
  "Due in 14 days": "مستحق بعد 14 يومًا",
  "Reserved": "محجوز",
  "Ready for pickup": "جاهز للاستلام",
  "6 days late": "متأخر 6 أيام",
  "Check out": "إعارة",
  "Return": "إرجاع",
  "Layla Mansour": "ليلى منصور",
  "Student · 2 of 8 loans · no fines": "طالبة · 2 من 8 إعارات · لا غرامات",
  "Due 6 Nov · held reservation fulfilled": "مستحق في 6 نوفمبر · تم تنفيذ الحجز",
  "Held for the next reader at Main Library": "محجوز للقارئ التالي في المكتبة الرئيسية",
  "Good morning": "صباح الخير",
  "Recent circulation": "أحدث عمليات الإعارة",

  // Sign in and sign up
  "Welcome back to BookSaw.": "مرحبًا بعودتك إلى BookSaw.",
  "New to BookSaw?": "جديد على BookSaw؟",
  "Password": "كلمة المرور",
  "Signing in": "جارٍ تسجيل الدخول",
  "That email and password don't match.": "البريد الإلكتروني وكلمة المرور غير متطابقين.",
  "Please confirm your email address first — check your inbox for the link.": "يُرجى تأكيد بريدك الإلكتروني أولًا — تحقق من صندوق الوارد للعثور على الرابط.",
  "We couldn't sign you in. Please try again.": "تعذّر تسجيل دخولك. يُرجى المحاولة مرة أخرى.",
  "Create your account": "أنشئ حسابك",
  "Save books to your cart and check out in minutes.": "أضف الكتب إلى سلتك وأتمم الشراء في دقائق.",
  "Confirm password": "تأكيد كلمة المرور",
  "At least 6 characters.": "6 أحرف على الأقل.",
  "Creating account": "جارٍ إنشاء الحساب",
  "We couldn't create your account. Please try again.": "تعذّر إنشاء حسابك. يُرجى المحاولة مرة أخرى.",
  "Your account is ready. If we sent you a confirmation email, confirm your address before signing in.":
    "حسابك جاهز. إذا أرسلنا إليك رسالة تأكيد بالبريد الإلكتروني، فأكّد عنوانك قبل تسجيل الدخول.",
  "Checking your access…": "جارٍ التحقق من صلاحيات الوصول…",
  "You've been signed out.": "تم تسجيل خروجك.",
  "Enter your email address.": "أدخل بريدك الإلكتروني.",
  "Enter a valid email address, like name@example.com.": "أدخل بريدًا إلكترونيًا صالحًا، مثل name@example.com.",
  "Enter your name.": "أدخل اسمك.",
  "Your name needs at least 3 characters.": "يجب أن يتكون اسمك من 3 أحرف على الأقل.",
  "Your name can be at most 30 characters.": "يجب ألا يتجاوز اسمك 30 حرفًا.",
  "Choose a password.": "اختر كلمة مرور.",
  "Your password needs at least 6 characters.": "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.",
  "Passwords don't match.": "كلمتا المرور غير متطابقتين.",
  "Confirm your password.": "أكّد كلمة المرور.",
  "Enter your password.": "أدخل كلمة المرور.",

  // Profile
  "Your account · BookSaw": "حسابك · BookSaw",
  "Your account": "حسابك",
  "Administrator": "مدير النظام",
  "Customer": "عميل",
  "{books} waiting for checkout": "{books} بانتظار إتمام الشراء",
  "Loans, reservations, fines and notifications": "الإعارات والحجوزات والغرامات والإشعارات",
  "Browse books": "تصفّح الكتب",
  "Discover your next read": "اكتشف قراءتك التالية",
  "Run the library: circulation, catalogue, members and more": "أدِر المكتبة: الإعارة والفهرس والأعضاء وغير ذلك",

  // Cart and checkout
  "Your cart · BookSaw": "سلتك · BookSaw",
  "Your cart": "سلتك",
  "Loading your cart…": "جارٍ تحميل سلتك…",
  "We couldn't load your cart.": "تعذّر تحميل سلتك.",
  "Your cart is empty": "سلتك فارغة",
  "Your cart is empty.": "أصبحت سلتك فارغة.",
  "Books you add will appear here.": "ستظهر هنا الكتب التي تضيفها.",
  "Items in your cart": "العناصر في سلتك",
  "Empty cart": "إفراغ السلة",
  "Empty your cart?": "هل تريد إفراغ سلتك؟",
  "This removes all {books} from your cart.": "سيؤدي هذا إلى إزالة {books} من سلتك.",
  "Couldn't empty your cart.": "تعذّر إفراغ سلتك.",
  "Removed “{title}” from your cart.": "تمت إزالة «{title}» من سلتك.",
  "Couldn't remove this book.": "تعذّرت إزالة هذا الكتاب.",
  "Remove {title} from cart": "إزالة {title} من السلة",
  "Untitled": "بلا عنوان",
  "Order summary": "ملخص الطلب",
  "Items ({count})": "العناصر ({count})",
  "Delivery": "التوصيل",
  "Free": "مجاني",
  "Checkout": "إتمام الشراء",
  "Thank you — your order is placed!": "شكرًا لك — تم تقديم طلبك!",
  "Order reference {reference}. You'll pay {amount} in cash on delivery.": "رقم الطلب المرجعي {reference}. ستدفع {amount} نقدًا عند الاستلام.",
  "Continue shopping": "متابعة التسوق",
  "Redirecting to secure payment…": "جارٍ التحويل إلى صفحة الدفع الآمن…",
  "We couldn't place your order. Please try again.": "تعذّر تقديم طلبك. يُرجى المحاولة مرة أخرى.",
  "Delivery details": "تفاصيل التوصيل",
  "Delivery address": "عنوان التوصيل",
  "The courier will call this number.": "سيتصل مندوب التوصيل بهذا الرقم.",
  "Note for the courier (optional)": "ملاحظة لمندوب التوصيل (اختيارية)",
  "Payment": "الدفع",
  "Cash on delivery": "الدفع نقدًا عند الاستلام",
  "Pay securely online with Stripe.": "ادفع بأمان عبر الإنترنت باستخدام Stripe.",
  "Pay when your books arrive.": "ادفع عند وصول كتبك.",
  "Placing order": "جارٍ تقديم الطلب",
  "Continue to payment · {total}": "متابعة إلى الدفع · {total}",
  "Place order · {total}": "تقديم الطلب · {total}",
  "Back to cart": "العودة إلى السلة",
  "Enter a delivery address.": "أدخل عنوان التوصيل.",
  "Enter your full delivery address.": "أدخل عنوان التوصيل كاملًا.",
  "Enter a mobile number so the courier can reach you.": "أدخل رقم هاتف محمول ليتمكن مندوب التوصيل من الوصول إليك.",
};

export const plurals = {
  overdue: {
    en: { one: "{count} overdue", other: "{count} overdue" },
    ar: { zero: "لا توجد متأخرات", one: "متأخرة واحدة", two: "متأخرتان", few: "{count} متأخرات", many: "{count} متأخرة", other: "{count} متأخرة" },
  },
};
