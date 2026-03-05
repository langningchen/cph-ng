# 测试点消失问题修复说明 / Test Case Disappearing Bug Fix

## 问题描述 / Problem Description

用户报告测试点有时会消失，特别是在：
- 快速切换文件时
- 关闭 VSCode 后重新打开

Users reported that test cases sometimes disappear, especially when:
- Rapidly switching between files
- Closing and reopening VSCode

## 根本原因分析 / Root Cause Analysis

经过详细分析，发现了以下 4 个主要问题：

After detailed analysis, 4 main issues were identified:

### 1. `onActiveEditorChanged()` 并发调用无保护 / No Protection for Concurrent `onActiveEditorChanged()` Calls

**问题 / Problem:**
- 当用户快速切换文件时，`onActiveEditorChanged()` 可能被并发调用多次
- 第一次调用正在持久化问题 A，第二次调用已经开始加载问题 B
- 导致问题 A 的持久化可能未完成就被中断

When users rapidly switch files, `onActiveEditorChanged()` can be called concurrently:
- First call is persisting problem A while second call starts loading problem B
- Problem A's persistence may be interrupted before completion

**修复 / Fix:**
```typescript
private switchingPromise: Promise<void> | null = null;

public async onActiveEditorChanged() {
  // 串行化调用，防止并发
  if (this.switchingPromise) {
    await this.switchingPromise;
  }
  this.switchingPromise = this._onActiveEditorChangedImpl();
  try {
    await this.switchingPromise;
  } finally {
    this.switchingPromise = null;
  }
}
```

### 2. 测试点修改后无自动保存 / No Auto-Save After Test Case Modifications

**问题 / Problem:**
- `AddTestcase`, `DeleteTestcase`, `SetTestcaseString` 等操作只修改内存
- 只有在切换文件或关闭 VSCode 时才保存
- 如果 VSCode 崩溃或用户快速切换，更改会丢失

Operations like `AddTestcase`, `DeleteTestcase`, `SetTestcaseString` only modify in-memory data:
- Changes are only saved when switching files or closing VSCode
- If VSCode crashes or user switches rapidly, changes are lost

**修复 / Fix:**
```typescript
private autoSaveTimer: NodeJS.Timeout | null = null;
private readonly autoSaveDelayMs = 2000; // 2秒防抖

private scheduleAutoSave() {
  if (!this.active) return;
  
  if (this.autoSaveTimer) {
    clearTimeout(this.autoSaveTimer);
  }
  
  this.autoSaveTimer = setTimeout(async () => {
    if (!this.active) return;
    
    try {
      await this.problemService.save(this.active.problem);
    } catch (e) {
      this.logger.error('Auto-save failed', e);
    }
  }, this.autoSaveDelayMs);
}

// 在测试点变更时调用
private onAddTestcase = async (...) => {
  // ... 原有逻辑
  this.scheduleAutoSave();
};
```

### 3. `persist()` 即使保存失败也删除内存数据 / `persist()` Deletes From Memory Even on Save Failure

**问题 / Problem:**
- 原代码在保存后立即删除内存中的问题
- 如果保存失败，内存数据已经丢失，无法重试

Original code deletes from memory immediately after save attempt:
- If save fails, in-memory data is already gone and cannot be retried

**修复 / Fix:**
```typescript
public async persist(problemId: ProblemId): Promise<boolean> {
  const backgroundProblem = this.backgroundProblems.get(problemId);
  if (!backgroundProblem || backgroundProblem.ac) return false;
  
  // ... 检查逻辑
  
  try {
    await this.problemService.save(backgroundProblem.problem);
  } catch (e) {
    this.logger.error('Failed to save problem, keeping in memory', e);
    return false; // 保存失败时返回 false，不删除内存数据
  }
  
  // 只有成功保存后才删除
  this.backgroundProblems.delete(problemId);
  return true;
}
```

### 4. `persist()` 中的活跃问题检查存在竞态条件 / Race Condition in `persist()` Active Problem Check

**问题 / Problem:**
- 原代码使用异步的 `getByPath()` 检查活跃问题
- 在等待期间，活跃路径可能已经改变
- 可能导致错误地持久化或不持久化问题

Original code used async `getByPath()` to check for active problem:
- Active path can change during the await
- May incorrectly persist or skip persistence

**修复 / Fix:**
```typescript
// 同步检查，避免竞态
const activePath = this.activePath.getActivePath();
if (activePath) {
  for (const bgProblem of this.backgroundProblems.values()) {
    if (bgProblem.problemId === problemId && bgProblem.problem.isRelated(activePath)) {
      this.logger.trace('Cannot persist active problem', problemId);
      return false;
    }
  }
}
```

## 修复效果 / Expected Improvements

1. **快速切换文件**: 上一个问题完全保存后才加载新问题
   **Rapid file switching**: Previous problem fully saved before loading new one

2. **测试点修改**: 最后一次修改后 2 秒自动保存
   **Test case modifications**: Auto-saved 2 seconds after last change

3. **VSCode 崩溃**: 最近的更改会被保留（最多丢失 2 秒内的更改）
   **VSCode crash**: Recent changes preserved (max 2s loss)

4. **保存失败**: 问题保留在内存中等待重试
   **Save failures**: Problem stays in memory for retry

5. **并发操作**: 串行化处理，防止数据损坏
   **Concurrent operations**: Serialized to prevent corruption

## 测试建议 / Testing Recommendations

### 手动测试 / Manual Testing

1. **快速切换测试 / Rapid Switching Test:**
   - 创建问题 A 并添加测试点
   - 立即切换到文件 B
   - 再切换回文件 A
   - 验证测试点是否完整

2. **崩溃恢复测试 / Crash Recovery Test:**
   - 添加测试点
   - 等待 2 秒（自动保存触发）
   - 强制关闭 VSCode
   - 重新打开，验证测试点是否保存

3. **连续修改测试 / Continuous Modification Test:**
   - 快速添加多个测试点
   - 观察是否只触发一次保存（防抖工作）

### 自动化测试 / Automated Testing

骨架测试已添加在：
- `tests/infrastructure/services/activeProblemCoordinator.test.ts`
- `tests/infrastructure/problems/problemRepository.test.ts`

Test skeletons added in:
- `tests/infrastructure/services/activeProblemCoordinator.test.ts`
- `tests/infrastructure/problems/problemRepository.test.ts`

## 性能影响 / Performance Impact

- **额外开销**: 每次测试点修改后 2 秒的自动保存定时器
- **优化**: 使用防抖，多次修改只触发一次保存
- **内存**: 活跃问题保持在内存中直到切换文件

**Additional overhead**: 2-second auto-save timer after each test case modification
**Optimization**: Debouncing ensures multiple changes trigger only one save
**Memory**: Active problem stays in memory until file switch

## 向后兼容性 / Backward Compatibility

所有修改都是向后兼容的：
- 不改变数据格式
- 不改变 API 接口
- 只改进内部行为

All changes are backward compatible:
- No changes to data format
- No changes to API interfaces
- Only improved internal behavior

## 相关文件 / Related Files

- `src/infrastructure/services/activeProblemCoordinator.ts`
- `src/infrastructure/problems/problemRepository.ts`
- `tests/infrastructure/services/activeProblemCoordinator.test.ts`
- `tests/infrastructure/problems/problemRepository.test.ts`
