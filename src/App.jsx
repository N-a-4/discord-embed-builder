import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

function App() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#5865F2');
  const [author, setAuthor] = useState('');
  const [authorIcon, setAuthorIcon] = useState('');
  const [authorUrl, setAuthorUrl] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [image, setImage] = useState('');
  const [footer, setFooter] = useState('');
  const [footerIcon, setFooterIcon] = useState('');
  const [timestamp, setTimestamp] = useState(false);
  const [fields, setFields] = useState([]);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [replyModal, setReplyModal] = useState({ isOpen: false, comment: null });
  const [newReply, setNewReply] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'comments'), (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(commentsData.sort((a, b) => b.timestamp - a.timestamp));
    });

    return () => unsubscribe();
  }, []);

  const addField = () => {
    setFields([...fields, { name: '', value: '', inline: false }]);
  };

  const updateField = (index, key, value) => {
    const newFields = [...fields];
    newFields[index][key] = value;
    setFields(newFields);
  };

  const removeField = (index) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const addComment = async () => {
    if (!newComment.trim() || !commentAuthor.trim()) return;

    try {
      await addDoc(collection(db, 'comments'), {
        text: newComment,
        author: commentAuthor,
        timestamp: Date.now(),
        replies: []
      });
      setNewComment('');
      setCommentAuthor('');
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await deleteDoc(doc(db, 'comments', commentId));
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  const openReplyModal = (comment) => {
    setReplyModal({ isOpen: true, comment });
    setNewReply('');
  };

  const closeReplyModal = () => {
    setReplyModal({ isOpen: false, comment: null });
    setNewReply('');
  };

  const addReply = async () => {
    if (!newReply.trim() || !commentAuthor.trim()) return;

    try {
      const reply = {
        text: newReply,
        author: commentAuthor,
        timestamp: Date.now()
      };

      await updateDoc(doc(db, 'comments', replyModal.comment.id), {
        replies: arrayUnion(reply)
      });

      setNewReply('');
    } catch (error) {
      console.error('Error adding reply:', error);
    }
  };

  const generateEmbed = () => {
    const embed = {
      title: title || undefined,
      description: description || undefined,
      color: parseInt(color.replace('#', ''), 16),
      author: author ? {
        name: author,
        icon_url: authorIcon || undefined,
        url: authorUrl || undefined
      } : undefined,
      thumbnail: thumbnail ? { url: thumbnail } : undefined,
      image: image ? { url: image } : undefined,
      footer: footer ? {
        text: footer,
        icon_url: footerIcon || undefined
      } : undefined,
      timestamp: timestamp ? new Date().toISOString() : undefined,
      fields: fields.length > 0 ? fields.filter(f => f.name && f.value) : undefined
    };

    return JSON.stringify({ embeds: [embed] }, null, 2);
  };

  const renderMarkdown = (text) => {
    const html = marked(text);
    return DOMPurify.sanitize(html);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('ru-RU');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Discord Embed Builder
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Форма создания embed */}
          <div className="bg-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-2xl font-semibold mb-4">Создать Embed</h2>
            
            <div>
              <label className="block text-sm font-medium mb-2">Заголовок</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Заголовок embed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Описание (поддерживает Markdown)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Описание embed (можно использовать **жирный**, *курсив*, `код` и другие Markdown элементы)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Цвет</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 bg-gray-700 border border-gray-600 rounded-md cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Автор</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Имя автора"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Иконка автора</label>
                <input
                  type="url"
                  value={authorIcon}
                  onChange={(e) => setAuthorIcon(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="URL иконки"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Ссылка автора</label>
                <input
                  type="url"
                  value={authorUrl}
                  onChange={(e) => setAuthorUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="URL ссылки"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Миниатюра</label>
                <input
                  type="url"
                  value={thumbnail}
                  onChange={(e) => setThumbnail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="URL миниатюры"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Изображение</label>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="URL изображения"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Подвал</label>
                <input
                  type="text"
                  value={footer}
                  onChange={(e) => setFooter(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Текст подвала"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Иконка подвала</label>
                <input
                  type="url"
                  value={footerIcon}
                  onChange={(e) => setFooterIcon(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="URL иконки подвала"
                />
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="timestamp"
                checked={timestamp}
                onChange={(e) => setTimestamp(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="timestamp" className="text-sm font-medium">Добавить временную метку</label>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Поля</h3>
                <button
                  onClick={addField}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  Добавить поле
                </button>
              </div>
              
              {fields.map((field, index) => (
                <div key={index} className="bg-gray-700 p-4 rounded-md mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => updateField(index, 'name', e.target.value)}
                      className="px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Название поля"
                    />
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => updateField(index, 'value', e.target.value)}
                      className="px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Значение поля"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={field.inline}
                        onChange={(e) => updateField(index, 'inline', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">В строку</span>
                    </label>
                    <button
                      onClick={() => removeField(index)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-md text-sm transition-colors"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Превью embed */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Превью</h2>
            <div className="bg-gray-700 p-4 rounded-md">
              <div className="flex">
                <div className="w-1 rounded-l-md mr-3" style={{ backgroundColor: color }}></div>
                <div className="flex-1">
                  {author && (
                    <div className="flex items-center mb-2">
                      {authorIcon && <img src={authorIcon} alt="" className="w-6 h-6 rounded-full mr-2" />}
                      <span className="font-semibold text-sm">
                        {authorUrl ? <a href={authorUrl} className="text-blue-400 hover:underline">{author}</a> : author}
                      </span>
                    </div>
                  )}
                  
                  {title && <h3 className="font-bold text-lg mb-2 text-blue-400">{title}</h3>}
                  
                  {description && (
                    <div 
                      className="text-sm mb-3 prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(description) }}
                    />
                  )}
                  
                  {fields.length > 0 && (
                    <div className="grid gap-2 mb-3">
                      {fields.filter(f => f.name && f.value).map((field, index) => (
                        <div key={index} className={field.inline ? "inline-block mr-4" : "block"}>
                          <div className="font-semibold text-sm">{field.name}</div>
                          <div className="text-sm text-gray-300">{field.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {image && <img src={image} alt="" className="max-w-full rounded-md mb-3" />}
                  
                  <div className="flex justify-between items-end">
                    <div>
                      {footer && (
                        <div className="flex items-center text-xs text-gray-400">
                          {footerIcon && <img src={footerIcon} alt="" className="w-4 h-4 rounded-full mr-1" />}
                          <span>{footer}</span>
                          {timestamp && <span className="ml-2">• {new Date().toLocaleString('ru-RU')}</span>}
                        </div>
                      )}
                      {!footer && timestamp && (
                        <div className="text-xs text-gray-400">{new Date().toLocaleString('ru-RU')}</div>
                      )}
                    </div>
                    {thumbnail && <img src={thumbnail} alt="" className="w-20 h-20 rounded-md object-cover" />}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">JSON код</h3>
              <pre className="bg-gray-900 p-4 rounded-md text-sm overflow-x-auto">
                <code>{generateEmbed()}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* Секция комментариев */}
        <div className="mt-12 bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-6">Комментарии</h2>
          
          {/* Форма добавления комментария */}
          <div className="mb-8 bg-gray-700 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                className="px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ваше имя"
              />
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              placeholder="Напишите комментарий..."
            />
            <button
              onClick={addComment}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Добавить комментарий
            </button>
          </div>

          {/* Список комментариев */}
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-gray-700 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-semibold text-blue-400">{comment.author}</span>
                    <span className="text-gray-400 text-sm ml-2">{formatTimestamp(comment.timestamp)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openReplyModal(comment)}
                      className="text-gray-400 hover:text-blue-400 transition-colors"
                      title="Ответить"
                    >
                      💬
                    </button>
                    <button
                      onClick={() => deleteComment(comment.id)}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                      title="Удалить"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <p className="text-gray-200 mb-3">{comment.text}</p>
                
                {/* Отображение ответов */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="ml-6 border-l-2 border-gray-600 pl-4 space-y-3">
                    <div className="text-sm text-gray-400 font-medium">
                      Ответы ({comment.replies.length}):
                    </div>
                    {comment.replies.map((reply, index) => (
                      <div key={index} className="bg-gray-600 p-3 rounded-md">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-blue-300 text-sm">{reply.author}</span>
                          <span className="text-gray-400 text-xs">{formatTimestamp(reply.timestamp)}</span>
                        </div>
                        <p className="text-gray-200 text-sm">{reply.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Модальное окно для ответов */}
      {replyModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Ответы на комментарий</h3>
                <button
                  onClick={closeReplyModal}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Оригинальный комментарий */}
              <div className="bg-gray-700 p-4 rounded-lg mb-6">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-blue-400">{replyModal.comment.author}</span>
                  <span className="text-gray-400 text-sm">{formatTimestamp(replyModal.comment.timestamp)}</span>
                </div>
                <p className="text-gray-200">{replyModal.comment.text}</p>
              </div>

              {/* Существующие ответы */}
              {replyModal.comment.replies && replyModal.comment.replies.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-medium mb-3">Ответы ({replyModal.comment.replies.length}):</h4>
                  <div className="space-y-3">
                    {replyModal.comment.replies.map((reply, index) => (
                      <div key={index} className="bg-gray-600 p-3 rounded-md">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-semibold text-blue-300">{reply.author}</span>
                          <span className="text-gray-400 text-sm">{formatTimestamp(reply.timestamp)}</span>
                        </div>
                        <p className="text-gray-200">{reply.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Форма для нового ответа */}
              <div className="bg-gray-700 p-4 rounded-lg">
                <h4 className="text-lg font-medium mb-3">Добавить ответ:</h4>
                <div className="mb-3">
                  <input
                    type="text"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ваше имя"
                  />
                </div>
                <textarea
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
                  placeholder="Напишите ответ..."
                />
                <div className="flex gap-3">
                  <button
                    onClick={addReply}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                  >
                    Отправить ответ
                  </button>
                  <button
                    onClick={closeReplyModal}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;