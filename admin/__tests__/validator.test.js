// admin/js/validator.js 单元测试
import { describe, it, expect, beforeEach } from 'vitest';

describe('validateForm', () => {
  it('空 schema 应该返回 valid', () => {
    const result = validateForm({}, { field1: 'test' });
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors).length).toBe(0);
  });

  describe('required 规则', () => {
    it('必填字段为空应该报错', () => {
      const schema = { name: { required: true, message: '请输入名称' } };
      const result = validateForm(schema, { name: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.name).toEqual(['请输入名称']);
    });

    it('必填字段不为空应该通过', () => {
      const schema = { name: { required: true } };
      const result = validateForm(schema, { name: 'hello' });
      expect(result.valid).toBe(true);
    });

    it('必填字段缺失应该报错', () => {
      const schema = { name: { required: true, message: '必填' } };
      const result = validateForm(schema, {});
      expect(result.valid).toBe(false);
      expect(result.errors.name).toEqual(['必填']);
    });
  });

  describe('minLength / maxLength 规则', () => {
    it('字符串长度不足应该报错', () => {
      const schema = { title: { minLength: 3, message: '至少3个字符' } };
      const result = validateForm(schema, { title: 'ab' });
      expect(result.valid).toBe(false);
      expect(result.errors.title).toEqual(['至少3个字符']);
    });

    it('字符串长度超过上限应该报错', () => {
      const schema = { title: { maxLength: 5, message: '最多5个字符' } };
      const result = validateForm(schema, { title: 'abcdef' });
      expect(result.valid).toBe(false);
      expect(result.errors.title).toEqual(['最多5个字符']);
    });

    it('长度在范围内应该通过', () => {
      const schema = { title: { minLength: 2, maxLength: 10 } };
      const result = validateForm(schema, { title: 'hello' });
      expect(result.valid).toBe(true);
    });
  });

  describe('pattern 规则', () => {
    it('不匹配正则应该报错', () => {
      const schema = { email: { pattern: /^[a-z]+@[a-z]+\.[a-z]+$/, message: '邮箱格式不正确' } };
      const result = validateForm(schema, { email: 'not-an-email' });
      expect(result.valid).toBe(false);
    });

    it('匹配正则应该通过', () => {
      const schema = { email: { pattern: /^[a-z]+@[a-z]+\.[a-z]+$/ } };
      const result = validateForm(schema, { email: 'test@test.com' });
      expect(result.valid).toBe(true);
    });
  });

  describe('number 规则', () => {
    it('非数字值应该报错', () => {
      const schema = { age: { number: true, message: '请输入数字' } };
      const result = validateForm(schema, { age: 'abc' });
      expect(result.valid).toBe(false);
      expect(result.errors.age).toEqual(['请输入数字']);
    });

    it('有效数字应该通过', () => {
      const schema = { age: { number: true } };
      const result = validateForm(schema, { age: '25' });
      expect(result.valid).toBe(true);
    });

    it('数字小于 min 应该报错', () => {
      const schema = { price: { number: true, min: 0, message: '不能小于0' } };
      const result = validateForm(schema, { price: '-5' });
      expect(result.valid).toBe(false);
      expect(result.errors.price).toEqual(['不能小于0']);
    });

    it('数字大于 max 应该报错', () => {
      const schema = { percent: { number: true, max: 100, message: '不能大于100' } };
      const result = validateForm(schema, { percent: '150' });
      expect(result.valid).toBe(false);
      expect(result.errors.percent).toEqual(['不能大于100']);
    });

    it('数字在范围内应该通过', () => {
      const schema = { price: { number: true, min: 0, max: 9999 } };
      const result = validateForm(schema, { price: '49.99' });
      expect(result.valid).toBe(true);
    });
  });

  describe('组合规则', () => {
    it('多个规则同时生效', () => {
      const schema = {
        title: [
          { required: true, message: '请输入标题' },
          { maxLength: 10, message: '标题最多10个字符' }
        ]
      };
      const result = validateForm(schema, { title: 'this is a very long title' });
      expect(result.valid).toBe(false);
      expect(result.errors.title).toEqual(['标题最多10个字符']);
    });

    it('多字段同时验证', () => {
      const schema = {
        name: { required: true, message: '必填' },
        age: { number: true, message: '必须为数字' }
      };
      const result = validateForm(schema, { name: '', age: 'abc' });
      expect(result.valid).toBe(false);
      expect(Object.keys(result.errors).length).toBe(2);
    });

    it('多字段部分失败只收集有错误的字段', () => {
      const schema = {
        name: { required: true, message: '必填' },
        desc: { maxLength: 100 }
      };
      const result = validateForm(schema, { name: '', desc: 'ok' });
      expect(result.valid).toBe(false);
      expect(Object.keys(result.errors)).toEqual(['name']);
    });
  });
});

describe('clearFieldErrors', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <form id="testForm">
        <div class="form-group">
          <input id="field1" class="field-invalid" aria-invalid="true">
          <div class="field-error">some error</div>
        </div>
        <div class="form-group">
          <input id="field2">
          <div class="field-error">another error</div>
        </div>
      </form>
    `;
  });

  it('清除所有字段错误文本', () => {
    clearFieldErrors(document.getElementById('testForm'));
    const errors = document.querySelectorAll('.field-error');
    errors.forEach(el => expect(el.textContent).toBe(''));
  });

  it('移除 field-invalid 类名', () => {
    clearFieldErrors(document.getElementById('testForm'));
    const invalidField = document.getElementById('field1');
    expect(invalidField.classList.contains('field-invalid')).toBe(false);
  });

  it('移除 aria-invalid 属性', () => {
    clearFieldErrors(document.getElementById('testForm'));
    const invalidField = document.getElementById('field1');
    expect(invalidField.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('showFieldErrors', () => {
  it('在已存在的 .field-error 元素中显示错误', () => {
    document.body.innerHTML = `
      <form id="testForm">
        <div class="form-group">
          <input id="field1">
          <div class="field-error"></div>
        </div>
      </form>
    `;
    showFieldErrors({ field1: ['验证失败'] });
    const errorEl = document.querySelector('.field-error');
    expect(errorEl.textContent).toBe('验证失败');
  });

  it('为无效字段添加 field-invalid 类名', () => {
    document.body.innerHTML = `
      <form id="testForm">
        <div class="form-group">
          <input id="field1">
          <div class="field-error"></div>
        </div>
      </form>
    `;
    showFieldErrors({ field1: ['验证失败'] });
    const field = document.getElementById('field1');
    expect(field.classList.contains('field-invalid')).toBe(true);
    expect(field.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('validateAndShow', () => {
  it('验证通过返回 valid: true', () => {
    document.body.innerHTML = `
      <form id="testForm">
        <div class="form-group">
          <input id="field1" value="hello">
          <div class="field-error"></div>
        </div>
      </form>
    `;
    const result = validateAndShow(
      { field1: { required: true } },
      { root: document.getElementById('testForm'), data: { field1: 'hello' } }
    );
    expect(result.valid).toBe(true);
  });

  it('验证失败返回 valid: false 并显示错误', () => {
    document.body.innerHTML = `
      <form id="testForm">
        <div class="form-group">
          <input id="field1" value="">
          <div class="field-error"></div>
        </div>
      </form>
    `;
    const result = validateAndShow(
      { field1: { required: true, message: '必填' } },
      { root: document.getElementById('testForm'), data: { field1: '' } }
    );
    expect(result.valid).toBe(false);
    const errorEl = document.querySelector('.field-error');
    expect(errorEl.textContent).toBe('必填');
  });
});
