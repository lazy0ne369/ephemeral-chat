import { useRef } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useRoom } from '../../context/RoomContext';
import { EVENTS } from '../../../../shared/constants';

export default function ImageUpload({ onError }) {
  const socket = useSocket();
  const { activeChannel } = useRoom();
  const inputRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Client-side size check (5MB)
    if (file.size > 5 * 1024 * 1024) {
      onError('Image too large — max 5MB');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      socket.emit(EVENTS.MEDIA_UPLOAD, {
        channel: activeChannel,
        base64,
        mimeType: file.type,
        filename: file.name,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <button
        style={styles.btn}
        onClick={() => inputRef.current?.click()}
        title="Upload image"
      >
        📎
      </button>
    </>
  );
}

const styles = {
  btn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: '4px 6px',
    borderRadius: 4,
    opacity: 0.7,
    transition: 'opacity 0.1s',
  },
};
