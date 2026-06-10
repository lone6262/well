// 表单验证 — ES Module

function getFieldValue(fieldId) {
  const field = document.getElementById(fieldId);
  return field ? field.value.trim() : '';
}

function isEmpty(value) {
  return value === null || value === undefined || value === '';
}

function validateRule(value, rule) {
  if (rule.required && isEmpty(value)) {
    return rule.message || '此项为必填项';
  }

  if (isEmpty(value)) return '';

  if (rule.minLength && value.length < rule.minLength) {
    return rule.message || `至少输入 ${rule.minLength} 个字符`;
  }

  if (rule.maxLength && value.length > rule.maxLength) {
    return rule.message || `最多输入 ${rule.maxLength} 个字符`;
  }

  if (rule.pattern && !rule.pattern.test(value)) {
    return rule.message || '格式不正确';
  }

  if (rule.number) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      return rule.message || '请输入有效数字';
    }

    if (rule.min !== undefined && numberValue < rule.min) {
      return rule.message || `数值不能小于 ${rule.min}`;
    }

    if (rule.max !== undefined && numberValue > rule.max) {
      return rule.message || `数值不能大于 ${rule.max}`;
    }
  }

  return '';
}

export function validateForm(schema, data) {
  const errors = {};

  Object.keys(schema).forEach(function(fieldId) {
    const value = data && Object.prototype.hasOwnProperty.call(data, fieldId)
      ? data[fieldId]
      : getFieldValue(fieldId);
    const rules = Array.isArray(schema[fieldId]) ? schema[fieldId] : [schema[fieldId]];
    const fieldErrors = rules
      .map(function(rule) { return validateRule(value, rule); })
      .filter(Boolean);

    if (fieldErrors.length > 0) {
      errors[fieldId] = fieldErrors;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors: errors
  };
}

function findFieldError(field) {
  const group = field.closest('.form-group, .setting-item');
  return group ? group.querySelector('.field-error') : null;
}

export function clearFieldErrors(formRoot) {
  const root = formRoot || document;
  root.querySelectorAll('.field-error').forEach(function(error) {
    error.textContent = '';
  });
  root.querySelectorAll('.field-invalid').forEach(function(field) {
    field.classList.remove('field-invalid');
    field.removeAttribute('aria-invalid');
  });
}

export function showFieldErrors(errors) {
  Object.keys(errors).forEach(function(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const errorElement = findFieldError(field);
    const message = errors[fieldId][0];
    field.classList.add('field-invalid');
    field.setAttribute('aria-invalid', 'true');

    if (errorElement) {
      errorElement.textContent = message;
      return;
    }

    const group = field.closest('.form-group, .setting-item');
    if (!group) return;

    const created = document.createElement('div');
    created.className = 'field-error';
    created.textContent = message;
    group.appendChild(created);
  });
}

export function validateAndShow(schema, options) {
  const root = options && options.root ? options.root : document;
  clearFieldErrors(root);
  const result = validateForm(schema, options && options.data);

  if (!result.valid) {
    showFieldErrors(result.errors);
  }

  return result;
}
