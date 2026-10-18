import { store } from "../data/store.js";

export const getSave = async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const save = await store.getSave(playerId);

    if (!save) {
      return res.status(404).json({
        success: false,
        error: `Không tìm thấy dữ liệu lưu của người chơi ${playerId}`
      });
    }

    res.json({
      success: true,
      data: save
    });
  } catch (err) {
    next(err);
  }
};

export const saveProgress = async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const result = await store.setSave(playerId, req.body);

    res.json({
      success: true,
      message: "Lưu dữ liệu tiến trình game thành công",
      data: result
    });
  } catch (err) {
    next(err);
  }
};

export const deleteSave = async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const deleted = await store.deleteSave(playerId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `Không tìm thấy tiến trình để xóa cho người chơi ${playerId}`
      });
    }

    res.json({
      success: true,
      message: `Đã xóa thành công tiến trình của người chơi ${playerId}`
    });
  } catch (err) {
    next(err);
  }
};
