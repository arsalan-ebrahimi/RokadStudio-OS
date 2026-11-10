import { body, matchedData, param, query, validationResult } from "express-validator";
import { isIsoDateString, toDateOnly } from "../../Utils/date.js";

const INT32_MAX = 2147483647;
const MAX_BATCH_ROWS = 200;
const KPI_MAX_ABS = 9999999999.99;

const SCRUM_COLORS = ["ECOSYSTEM", "MALE", "FEMALE", "COLLEGE", "CLUB"];
const SPRINT_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED"];
const ITEM_STATUSES = ["TODO", "DOING", "DONE"];
const EVENT_SCHEDULE_TYPES = ["WEEKLY", "ONCE"];

const KPI_ALLOWED_ROW_KEYS = new Set([
  "id",
  "scrumId",
  "indicator",
  "formula",
  "strategicGoal",
  "unit",
  "target",
  "firstMonthTarget",
  "actualValue",
  "minExpected",
  "sortOrder",
  "updatedAt",
  "progressPercent",
  "status",
]);

const EVENT_ALLOWED_ROW_KEYS = new Set([
  "id",
  "scrumId",
  "name",
  "scheduleType",
  "dayOfWeek",
  "date",
  "startTime",
  "durationMinutes",
  "inputs",
  "outputs",
  "sortOrder",
]);

const isPlainObject = (val) =>
  val !== null && typeof val === "object" && !Array.isArray(val);

const isStrictPositiveInt32 = (val) =>
  typeof val === "number" && Number.isInteger(val) && val >= 1 && val <= INT32_MAX;

const isStrictIntInRange = (val, min, max = INT32_MAX) =>
  typeof val === "number" && Number.isInteger(val) && val >= min && val <= max;

const validationErrorResponse = (res, errors) => {
  const errorList = errors.map((err) => ({
    field: err.field || err.path || "body",
    message: err.message || err.msg,
  }));
  return res.status(400).json({
    success: false,
    message: errorList[0]?.message || "ورودی نامعتبر است",
    errors: errorList,
  });
};

export const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorList = errors.array();
    return res.status(400).json({
      success: false,
      message: errorList[0].msg,
      errors: errorList.map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  }

  const matchedParams = matchedData(req, { locations: ["params"], includeOptionals: false });
  const matchedQuery = matchedData(req, { locations: ["query"], includeOptionals: false });
  req.validatedParams = { ...(req.validatedParams || {}), ...matchedParams };
  req.validatedQuery = { ...(req.validatedQuery || {}), ...matchedQuery };

  const matchedBody = matchedData(req, { locations: ["body"], includeOptionals: true });
  const cleanBody = {};
  if (isPlainObject(req.body)) {
    for (const key of Object.keys(req.body)) {
      cleanBody[key] =
        Object.prototype.hasOwnProperty.call(matchedBody, key) && matchedBody[key] !== undefined
          ? matchedBody[key]
          : req.body[key];
    }
  }
  req.validatedBody = cleanBody;
  next();
};

const rejectUnknownKeysMiddleware = (allowedKeys, { requireNonEmpty = false, allowEmptyUndefinedBody = false } = {}) => {
  const allowedSet = new Set(allowedKeys);

  return (req, res, next) => {
    const rawBody = req.body;
    if (rawBody === undefined && allowEmptyUndefinedBody) {
      req.body = {};
      return next();
    }

    if (!isPlainObject(rawBody)) {
      return validationErrorResponse(res, [
        { field: "body", message: "بدنه درخواست باید یک آبجکت JSON معتبر باشد" },
      ]);
    }

    const keys = Object.keys(rawBody);
    const unknown = keys.filter((k) => !allowedSet.has(k));
    if (unknown.length > 0) {
      return validationErrorResponse(
        res,
        unknown.map((k) => ({
          field: k,
          message: `فیلد ناشناخته یا غیرمجاز در درخواست: ${k}`,
        }))
      );
    }

    if (requireNonEmpty && keys.length === 0) {
      return validationErrorResponse(res, [
        { field: "body", message: "حداقل یک فیلد برای ویرایش باید ارسال شود" },
      ]);
    }

    next();
  };
};

const rejectUnknownQueryMiddleware = (allowedKeys) => {
  const allowedSet = new Set(allowedKeys);
  return (req, res, next) => {
    const unknown = Object.keys(req.query || {}).filter((k) => !allowedSet.has(k));
    if (unknown.length > 0) {
      return validationErrorResponse(
        res,
        unknown.map((k) => ({
          field: k,
          message: `پارامتر جستجوی نامعتبر: ${k}`,
        }))
      );
    }
    next();
  };
};

const strictOptionalString = (field, { max, min = 0, nullable = false, messagePrefix = field } = {}) =>
  body(field)
    .optional({ nullable })
    .custom((val) => {
      if (val === null && nullable) return true;
      if (typeof val !== "string") {
        throw new Error(`${messagePrefix} باید از نوع رشته متنی باشد`);
      }
      const trimmed = val.trim();
      if (min > 0 && trimmed.length < min) {
        throw new Error(`${messagePrefix} نمی‌تواند کمتر از ${min} کاراکتر باشد`);
      }
      if (max !== undefined && trimmed.length > max) {
        throw new Error(`${messagePrefix} نباید بیشتر از ${max} کاراکتر باشد`);
      }
      return true;
    })
    .customSanitizer((val) => {
      if (val === null) return null;
      return typeof val === "string" ? val.trim() : val;
    });

const strictDateValidator = (val) => {
  if (val === undefined || val === null || val === "") return true;
  if (typeof val !== "string" || !isIsoDateString(val)) {
    throw new Error("تاریخ باید در فرمت معتبر YYYY-MM-DD باشد");
  }
  return true;
};

const strictNullableDateBody = (field) =>
  body(field)
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null) return true;
      if (typeof val !== "string" || (val.trim() !== "" && !isIsoDateString(val))) {
        throw new Error("تاریخ باید در فرمت معتبر YYYY-MM-DD باشد");
      }
      return true;
    })
    .customSanitizer((val) => {
      if (val === null) return null;
      if (typeof val !== "string") return val;
      const trimmed = val.trim();
      return trimmed === "" ? null : trimmed;
    });

const strictNullablePositiveIntBody = (field, label) =>
  body(field)
    .optional({ nullable: true })
    .custom((val) => {
      if (val === null) return true;
      if (!isStrictPositiveInt32(val)) {
        throw new Error(`${label} باید یک عدد صحیح مثبت معتبر باشد`);
      }
      return true;
    });

const strictPositiveIntArrayBody = (field, label, { required = false, max = MAX_BATCH_ROWS } = {}) => {
  const chain = body(field);
  const configured = required ? chain : chain.optional();
  return configured.custom((arr) => {
    if (!Array.isArray(arr)) {
      throw new Error(`فیلد ${label} باید آرایه باشد`);
    }
    if (arr.length > max) {
      throw new Error(`حداکثر ${max} مورد در ${label} مجاز است`);
    }
    for (let i = 0; i < arr.length; i++) {
      if (!isStrictPositiveInt32(arr[i])) {
        throw new Error(`شناسه ردیف ${i + 1} در ${label} باید عدد صحیح مثبت باشد`);
      }
    }
    return true;
  });
};

export const scrumIdValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد").toInt(),
  handleValidation,
];

export const scrumAndProjectIdValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد").toInt(),
  param("projectId").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه پروژه باید یک عدد صحیح مثبت باشد").toInt(),
  handleValidation,
];

export const sprintIdValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسپرینت باید یک عدد صحیح مثبت باشد").toInt(),
  handleValidation,
];

export const sprintProjectIdValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه پروژه اسپرینت باید یک عدد صحیح مثبت باشد").toInt(),
  handleValidation,
];

export const createScrumValidator = [
  rejectUnknownKeysMiddleware(["name", "description", "color", "adminIds"]),
  body("name")
    .custom((val) => {
      if (typeof val !== "string") {
        throw new Error("نام اسکرام الزامی و باید رشته متنی باشد");
      }
      const len = val.trim().length;
      if (len < 2 || len > 100) {
        throw new Error("نام اسکرام باید بین ۲ تا ۱۰۰ کاراکتر باشد");
      }
      return true;
    })
    .customSanitizer((val) => (typeof val === "string" ? val.trim() : val)),
  strictOptionalString("description", { max: 2000, nullable: true, messagePrefix: "توضیحات اسکرام" }),
  body("color")
    .optional()
    .isString()
    .withMessage("رنگ اسکرام نامعتبر است")
    .isIn(SCRUM_COLORS)
    .withMessage("گزینه رنگ انتخاب‌شده نامعتبر است"),
  strictPositiveIntArrayBody("adminIds", "adminIds", { required: false, max: 50 }),
  handleValidation,
];

export const updateScrumAdminsBodyValidator = [
  rejectUnknownKeysMiddleware(["userIds"]),
  strictPositiveIntArrayBody("userIds", "userIds", { required: true, max: 50 }),
  handleValidation,
];

export const updateScrumBodyValidator = [
  rejectUnknownKeysMiddleware(["name", "description", "color", "isActive"], { requireNonEmpty: true }),
  strictOptionalString("name", { min: 2, max: 100, messagePrefix: "نام اسکرام" }),
  strictOptionalString("description", { max: 2000, nullable: true, messagePrefix: "توضیحات اسکرام" }),
  body("color")
    .optional()
    .isString()
    .withMessage("رنگ اسکرام نامعتبر است")
    .isIn(SCRUM_COLORS)
    .withMessage("گزینه رنگ انتخاب‌شده نامعتبر است"),
  body("isActive")
    .optional()
    .custom((val) => {
      if (typeof val !== "boolean") {
        throw new Error("فیلد isActive باید از نوع boolean باشد");
      }
      return true;
    }),
  handleValidation,
];

export const updateScrumValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد").toInt(),
  ...updateScrumBodyValidator,
];

export const updateScrumMembersBodyValidator = [
  rejectUnknownKeysMiddleware(["members"]),
  body("members")
    .custom((members) => {
      if (!Array.isArray(members)) {
        throw new Error("فیلد members باید آرایه باشد");
      }
      if (members.length > MAX_BATCH_ROWS) {
        throw new Error(`حداکثر ${MAX_BATCH_ROWS} عضو مجاز است`);
      }

      const seenIds = new Set();
      for (let i = 0; i < members.length; i++) {
        const item = members[i];
        if (!isPlainObject(item)) {
          throw new Error(`عضو ردیف ${i + 1} باید یک آبجکت معتبر باشد`);
        }

        const extraKeys = Object.keys(item).filter((k) => k !== "userId" && k !== "label");
        if (extraKeys.length > 0) {
          throw new Error(`فیلد غیرمجاز در ردیف عضو ${i + 1}: ${extraKeys.join(", ")}`);
        }

        if (!isStrictPositiveInt32(item.userId)) {
          throw new Error(`شناسه کاربر (userId) در ردیف ${i + 1} نامعتبر است`);
        }

        if (seenIds.has(item.userId)) {
          throw new Error("شناسه کاربران در لیست اعضا نباید تکراری باشد");
        }
        seenIds.add(item.userId);

        if (item.label !== undefined && item.label !== null) {
          if (typeof item.label !== "string") {
            throw new Error(`برچسب عضو ردیف ${i + 1} باید رشته متنی یا null باشد`);
          }
          if (item.label.trim().length > 50) {
            throw new Error("برچسب عضو نباید بیشتر از ۵۰ کاراکتر باشد");
          }
        }
      }

      return true;
    }),
  handleValidation,
];

export const updateScrumMembersValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد").toInt(),
  ...updateScrumMembersBodyValidator,
];

export const createSprintBodyValidator = [
  rejectUnknownKeysMiddleware(["title", "description", "startDate", "endDate"], { allowEmptyUndefinedBody: true }),
  strictOptionalString("title", { min: 1, max: 100, nullable: true, messagePrefix: "عنوان اسپرینت" }),
  strictOptionalString("description", { max: 2000, nullable: true, messagePrefix: "توضیحات اسپرینت" }),
  strictNullableDateBody("startDate"),
  strictNullableDateBody("endDate"),
  body().custom((val) => {
    if (
      typeof val?.startDate === "string" &&
      typeof val?.endDate === "string" &&
      isIsoDateString(val.startDate) &&
      isIsoDateString(val.endDate)
    ) {
      if (toDateOnly(val.endDate).getTime() < toDateOnly(val.startDate).getTime()) {
        throw new Error("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد");
      }
    }
    return true;
  }),
  handleValidation,
];

export const createSprintValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد").toInt(),
  ...createSprintBodyValidator,
];

export const updateSprintBodyValidator = [
  rejectUnknownKeysMiddleware(["title", "description", "startDate", "endDate"], { requireNonEmpty: true }),
  strictOptionalString("title", { min: 1, max: 100, messagePrefix: "عنوان اسپرینت" }),
  strictOptionalString("description", { max: 2000, nullable: true, messagePrefix: "توضیحات اسپرینت" }),
  strictNullableDateBody("startDate"),
  strictNullableDateBody("endDate"),
  body().custom((val) => {
    if (
      typeof val?.startDate === "string" &&
      typeof val?.endDate === "string" &&
      isIsoDateString(val.startDate) &&
      isIsoDateString(val.endDate)
    ) {
      if (toDateOnly(val.endDate).getTime() < toDateOnly(val.startDate).getTime()) {
        throw new Error("تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد");
      }
    }
    return true;
  }),
  handleValidation,
];

export const updateSprintValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسپرینت باید یک عدد صحیح مثبت باشد").toInt(),
  ...updateSprintBodyValidator,
];

export const updateSprintStatusBodyValidator = [
  rejectUnknownKeysMiddleware(["status"]),
  body("status")
    .isString()
    .withMessage("وضعیت اسپرینت نامعتبر است")
    .isIn(SPRINT_STATUSES)
    .withMessage("وضعیت باید PLANNED، ACTIVE یا COMPLETED باشد"),
  handleValidation,
];

export const updateSprintStatusValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسپرینت باید یک عدد صحیح مثبت باشد").toInt(),
  ...updateSprintStatusBodyValidator,
];

export const createSprintProjectBodyValidator = [
  rejectUnknownKeysMiddleware(["name", "points", "assigneeId", "projectId"]),
  body("name")
    .custom((val) => {
      if (typeof val !== "string") {
        throw new Error("نام پروژه اسپرینت الزامی و باید رشته متنی باشد");
      }
      const len = val.trim().length;
      if (len < 1 || len > 150) {
        throw new Error("نام پروژه اسپرینت باید بین ۱ تا ۱۵۰ کاراکتر باشد");
      }
      return true;
    })
    .customSanitizer((val) => (typeof val === "string" ? val.trim() : val)),
  body("points")
    .optional()
    .custom((val) => {
      if (!isStrictIntInRange(val, 0, 100)) {
        throw new Error("پوینت باید عدد صحیح بین ۰ تا ۱۰۰ باشد");
      }
      return true;
    }),
  strictNullablePositiveIntBody("assigneeId", "assigneeId"),
  strictNullablePositiveIntBody("projectId", "projectId"),
  handleValidation,
];

export const createSprintProjectValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسپرینت باید یک عدد صحیح مثبت باشد").toInt(),
  ...createSprintProjectBodyValidator,
];

export const updateSprintProjectBodyValidator = [
  rejectUnknownKeysMiddleware(["name", "points", "assigneeId", "projectId", "status", "sortOrder"], { requireNonEmpty: true }),
  strictOptionalString("name", { min: 1, max: 150, messagePrefix: "نام پروژه اسپرینت" }),
  body("points")
    .optional()
    .custom((val) => {
      if (!isStrictIntInRange(val, 0, 100)) {
        throw new Error("پوینت باید عدد صحیح بین ۰ تا ۱۰۰ باشد");
      }
      return true;
    }),
  strictNullablePositiveIntBody("assigneeId", "assigneeId"),
  strictNullablePositiveIntBody("projectId", "projectId"),
  body("status")
    .optional()
    .isString()
    .withMessage("وضعیت تسک نامعتبر است")
    .isIn(ITEM_STATUSES)
    .withMessage("وضعیت باید TODO، DOING یا DONE باشد"),
  body("sortOrder")
    .optional()
    .custom((val) => {
      if (!isStrictIntInRange(val, 0, INT32_MAX)) {
        throw new Error("sortOrder باید عدد صحیح نامنفی معتبر باشد");
      }
      return true;
    }),
  handleValidation,
];

export const updateSprintProjectValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه پروژه اسپرینت باید یک عدد صحیح مثبت باشد").toInt(),
  ...updateSprintProjectBodyValidator,
];

export const batchKpiBodyValidator = [
  rejectUnknownKeysMiddleware(["rows"]),
  body("rows")
    .custom((rows) => {
      if (!Array.isArray(rows)) {
        throw new Error("فیلد rows باید آرایه باشد");
      }
      if (rows.length > MAX_BATCH_ROWS) {
        throw new Error(`حداکثر ${MAX_BATCH_ROWS} ردیف KPI مجاز است`);
      }

      const strLimits = {
        indicator: 255,
        formula: 500,
        strategicGoal: 500,
        unit: 50,
      };
      const numFields = ["target", "firstMonthTarget", "actualValue", "minExpected"];
      const seenIds = new Set();

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!isPlainObject(r)) {
          throw new Error(`ردیف ${i + 1} باید یک آبجکت معتبر باشد`);
        }

        const extraKeys = Object.keys(r).filter((k) => !KPI_ALLOWED_ROW_KEYS.has(k));
        if (extraKeys.length > 0) {
          throw new Error(`فیلد غیرمجاز در ردیف ${i + 1}: ${extraKeys.join(", ")}`);
        }

        if (r.id !== undefined && r.id !== null) {
          if (!isStrictPositiveInt32(r.id)) {
            throw new Error(`شناسه ردیف ${i + 1} نامعتبر است`);
          }
          if (seenIds.has(r.id)) {
            throw new Error("شناسه ردیف‌های KPI نمی‌تواند تکراری باشد");
          }
          seenIds.add(r.id);
        }

        for (const [f, maxLen] of Object.entries(strLimits)) {
          const val = r[f];
          if (val !== undefined && val !== null) {
            if (typeof val !== "string") {
              throw new Error(`فیلد ${f} در ردیف ${i + 1} باید رشته متنی باشد`);
            }
            if (val.trim().length > maxLen) {
              throw new Error(`طول فیلد ${f} در ردیف ${i + 1} نباید بیشتر از ${maxLen} کاراکتر باشد`);
            }
          }
        }

        for (const f of numFields) {
          const val = r[f];
          if (val !== undefined && val !== null && val !== "") {
            if (typeof val !== "number" || !Number.isFinite(val)) {
              throw new Error(`مقدار فیلد ${f} در ردیف ${i + 1} باید یک عدد معتبر باشد`);
            }
            if (Math.abs(val) > KPI_MAX_ABS) {
              throw new Error(`مقدار فیلد ${f} در ردیف ${i + 1} خارج از محدوده مجاز است`);
            }
          }
        }
      }

      return true;
    }),
  handleValidation,
];

export const batchKpiValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد").toInt(),
  ...batchKpiBodyValidator,
];

export const isEventRowEmpty = (r) => {
  const fields = [
    r.name,
    r.scheduleType,
    r.dayOfWeek,
    r.date,
    r.startTime,
    r.durationMinutes,
    r.inputs,
    r.outputs,
  ];
  return fields.every(
    (f) => f === undefined || f === null || f === "" || (typeof f === "string" && f.trim() === "")
  );
};

export const batchEventsBodyValidator = [
  rejectUnknownKeysMiddleware(["rows"]),
  body("rows")
    .custom((rows) => {
      if (!Array.isArray(rows)) {
        throw new Error("فیلد rows باید آرایه باشد");
      }
      if (rows.length > MAX_BATCH_ROWS) {
        throw new Error(`حداکثر ${MAX_BATCH_ROWS} رویداد مجاز است`);
      }

      const strLimits = {
        name: 150,
        inputs: 1000,
        outputs: 1000,
      };
      const seenIds = new Set();

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!isPlainObject(r)) {
          throw new Error(`ردیف ${i + 1} باید یک آبجکت معتبر باشد`);
        }

        const extraKeys = Object.keys(r).filter((k) => !EVENT_ALLOWED_ROW_KEYS.has(k));
        if (extraKeys.length > 0) {
          throw new Error(`فیلد غیرمجاز در ردیف ${i + 1}: ${extraKeys.join(", ")}`);
        }

        if (r.id !== undefined && r.id !== null) {
          if (!isStrictPositiveInt32(r.id)) {
            throw new Error(`شناسه ردیف ${i + 1} نامعتبر است`);
          }
          if (seenIds.has(r.id)) {
            throw new Error("شناسه رویدادها نمی‌تواند تکراری باشد");
          }
          seenIds.add(r.id);
        }

        for (const [f, maxLen] of Object.entries(strLimits)) {
          const val = r[f];
          if (val !== undefined && val !== null) {
            if (typeof val !== "string") {
              throw new Error(`فیلد ${f} در ردیف ${i + 1} باید رشته متنی باشد`);
            }
            if (val.trim().length > maxLen) {
              throw new Error(`طول فیلد ${f} در ردیف ${i + 1} نباید بیشتر از ${maxLen} کاراکتر باشد`);
            }
          }
        }

        if (r.startTime !== undefined && r.startTime !== null && typeof r.startTime !== "string") {
          throw new Error(`ساعت شروع در ردیف ${i + 1} باید رشته متنی باشد`);
        }

        if (r.date !== undefined && r.date !== null && typeof r.date !== "string") {
          throw new Error(`تاریخ در ردیف ${i + 1} باید رشته متنی با فرمت YYYY-MM-DD باشد`);
        }

        if (isEventRowEmpty(r)) {
          continue;
        }

        if (typeof r.name !== "string" || !r.name.trim()) {
          throw new Error("نام رویداد الزامی است");
        }

        if (typeof r.scheduleType !== "string" || !EVENT_SCHEDULE_TYPES.includes(r.scheduleType)) {
          throw new Error("نوع برگزاری باید WEEKLY یا ONCE باشد");
        }

        if (r.scheduleType === "WEEKLY") {
          if (!isStrictIntInRange(r.dayOfWeek, 0, 6)) {
            throw new Error("برای رویدادهای هفتگی، روز هفته باید عدد صحیح بین ۰ (شنبه) تا ۶ (جمعه) باشد");
          }
        } else {
          if (typeof r.date !== "string" || !r.date.trim() || !isIsoDateString(r.date)) {
            throw new Error("برای رویداد یکباره، تاریخ معتبر با فرمت YYYY-MM-DD الزامی است");
          }
        }

        if (r.startTime !== undefined && r.startTime !== null && r.startTime.trim() !== "") {
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.startTime.trim())) {
            throw new Error("ساعت شروع باید به فرمت HH:mm باشد");
          }
        }

        if (r.durationMinutes !== undefined && r.durationMinutes !== null && r.durationMinutes !== "") {
          if (!isStrictIntInRange(r.durationMinutes, 1, 1440)) {
            throw new Error("مدت جلسه باید عدد صحیح بین ۱ تا ۱۴۴۰ دقیقه باشد");
          }
        }
      }

      return true;
    }),
  handleValidation,
];

export const batchEventsValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد").toInt(),
  ...batchEventsBodyValidator,
];

export const scrumReportQueryValidator = [
  rejectUnknownQueryMiddleware(["sprintId", "from", "to"]),
  query("sprintId").optional().isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسپرینت نامعتبر است").toInt(),
  query("from").optional().custom(strictDateValidator),
  query("to").optional().custom(strictDateValidator),
  query().custom((_, { req }) => {
    const { from, to } = req.query || {};
    if (
      typeof from === "string" &&
      typeof to === "string" &&
      from !== "" &&
      to !== "" &&
      isIsoDateString(from) &&
      isIsoDateString(to) &&
      toDateOnly(from).getTime() > toDateOnly(to).getTime()
    ) {
      throw new Error("تاریخ شروع گزارش نمی‌تواند بعد از تاریخ پایان باشد");
    }
    return true;
  }),
  handleValidation,
];

export const scrumReportValidator = [
  param("id").isInt({ min: 1, max: INT32_MAX }).withMessage("شناسه اسکرام باید یک عدد صحیح مثبت باشد").toInt(),
  ...scrumReportQueryValidator,
];

export const createScrumProjectBodyValidator = [
  rejectUnknownKeysMiddleware(["name", "description", "memberIds"]),
  body("name")
    .custom((val) => {
      if (typeof val !== "string") {
        throw new Error("نام پروژه الزامی و باید رشته متنی باشد");
      }
      const len = val.trim().length;
      if (len < 2 || len > 100) {
        throw new Error("نام پروژه باید بین ۲ تا ۱۰۰ کاراکتر باشد");
      }
      return true;
    })
    .customSanitizer((val) => (typeof val === "string" ? val.trim() : val)),
  strictOptionalString("description", { max: 2000, nullable: true, messagePrefix: "توضیحات پروژه" }),
  strictPositiveIntArrayBody("memberIds", "memberIds", { required: false, max: MAX_BATCH_ROWS }),
  handleValidation,
];

export const availableScrumProjectsQueryValidator = [
  rejectUnknownQueryMiddleware(["q"]),
  query("q").optional().trim(),
  handleValidation,
];

export const linkScrumProjectBodyValidator = [
  rejectUnknownKeysMiddleware(["projectId"]),
  body("projectId").custom((val) => {
    if (!isStrictPositiveInt32(val)) {
      throw new Error("projectId باید یک عدد صحیح مثبت معتبر باشد");
    }
    return true;
  }),
  handleValidation,
];

export const updateScrumProjectMembersBodyValidator = [
  rejectUnknownKeysMiddleware(["userIds"]),
  strictPositiveIntArrayBody("userIds", "userIds", { required: true, max: MAX_BATCH_ROWS }),
  handleValidation,
];

export const scrumLeaderboardQueryValidator = [
  rejectUnknownQueryMiddleware(["period", "sprintId"]),
  query("period")
    .optional()
    .isIn(["SPRINT", "MONTH", "ALL"])
    .withMessage("بازه زمانی باید SPRINT، MONTH یا ALL باشد"),
  query("sprintId")
    .optional()
    .isInt({ min: 1, max: INT32_MAX })
    .withMessage("شناسه اسپرینت نامعتبر است")
    .toInt(),
  handleValidation,
];
