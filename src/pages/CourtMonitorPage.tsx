import React from 'react';
import { ViewerPage } from './ViewerPage';

/**
 * 体育館モニター / コート進行モニター画面
 * 閲覧専用モニター（ViewerPage）と共通化し、コート進行モニター・全体の状況（星取表/トーナメント）の
 * 1分毎の自動切替、およびマイチーム閲覧を完全サポート。
 */
export const CourtMonitorPage: React.FC = () => {
  return <ViewerPage />;
};
