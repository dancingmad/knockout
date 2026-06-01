import React, { useState } from 'react';
import { Modal, Select, Form, InputNumber, Button, Alert, Tag, Space } from 'antd';
import useStore from '../store';
import { SLOT_CATEGORIES, getCategoryById, getNextFreeSlot } from '../utils/ko2';

const { Option } = Select;

export default function AddToProjectModal({ open, sample, onClose }) {
  const { currentProject, projects, loadProject, addSoundToProject } = useStore();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  if (!sample) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Make sure the correct project is loaded
      if (!currentProject || currentProject.id !== values.projectId) {
        await loadProject(values.projectId);
      }

      const usedSlots = (currentProject?.sounds || []).map(s => s.slot);
      const slot = values.slot || getNextFreeSlot(usedSlots, values.category);

      if (!slot) {
        throw new Error(`No free slots in ${values.category} range`);
      }

      await addSoundToProject({
        slot,
        name: sample.name,
        filename: sample.filename,
        originalPath: sample.relativePath,
        optimizedPath: null,
        category: values.category,
        bpm: sample.bpm || 0,
        key: sample.key || '',
        size: sample.size,
        isLoop: sample.isLoop,
      });

      form.resetFields();
      onClose();
    } catch (e) {
      console.error('Add to project error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Default category from sample metadata
  const defaultCategory = sample.category || 'kick';
  const defaultSlot = getNextFreeSlot(
    (currentProject?.sounds || []).map(s => s.slot),
    defaultCategory
  );

  return (
    <Modal
      open={open}
      title={
        <span style={{ color: '#ff681d', fontSize: 12, letterSpacing: 1 }}>
          ADD TO PROJECT
        </span>
      }
      onCancel={onClose}
      footer={null}
      width={400}
    >
      <div style={{ marginBottom: 12, padding: '8px 12px', background: '#1a1a1a', borderRadius: 4 }}>
        <div style={{ fontSize: 11, color: '#eee', fontWeight: 'bold' }}>{sample.name}</div>
        <div style={{ fontSize: 9, color: '#666' }}>{sample.filename}</div>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          projectId: currentProject?.id,
          category: defaultCategory,
          slot: defaultSlot,
        }}
        size="small"
      >
        <Form.Item label="Project" name="projectId" rules={[{ required: true }]}>
          <Select>
            {projects.map(p => (
              <Option key={p.id} value={p.id}>{p.name}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="Category (Slot Range)" name="category" rules={[{ required: true }]}>
          <Select onChange={(val) => {
            const usedSlots = (currentProject?.sounds || []).map(s => s.slot);
            const nextSlot = getNextFreeSlot(usedSlots, val);
            form.setFieldValue('slot', nextSlot);
          }}>
            {SLOT_CATEGORIES.map(cat => (
              <Option key={cat.id} value={cat.id}>
                <span style={{
                  display: 'inline-block',
                  width: 8, height: 8,
                  borderRadius: 2,
                  background: cat.color,
                  marginRight: 6,
                }} />
                {cat.label} ({cat.range[0]}–{cat.range[1]})
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="Slot Number" name="slot">
          <InputNumber
            min={1}
            max={999}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={loading}
              style={{ background: '#ff681d', borderColor: '#ff681d' }}
            >
              Add Sample
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}
