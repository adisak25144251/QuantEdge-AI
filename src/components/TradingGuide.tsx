import React from 'react';
import { motion } from 'motion/react';
import { BookOpen, Target, Shield, Zap, TrendingUp, BarChart2 } from 'lucide-react';

export const TradingGuide = () => {
  return (
    <div className="space-y-8 pb-20 md:pb-0">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">คู่มือการใช้งานระบบเทรด</h2>
        <p className="text-slate-400">เรียนรู้ขั้นตอนและเทคนิคการใช้ QuantEdge AI เพื่อเพิ่มประสิทธิภาพการเทรดของคุณ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Step 1 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#13002b]/80 to-[#0a001a]/80 p-6 rounded-xl border border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.1)]"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xl border border-cyan-500/50">1</div>
            <h3 className="text-xl font-bold text-white">ตั้งค่าความเสี่ยง (Risk Management)</h3>
          </div>
          <p className="text-slate-300 mb-4 leading-relaxed">
            ก่อนเริ่มเทรด สิ่งสำคัญที่สุดคือการจัดการความเสี่ยง ไปที่เมนู <span className="text-cyan-400 font-semibold">การตั้งค่า (Settings)</span> เพื่อกำหนด:
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" /> <strong>ขนาดพอร์ตโฟลิโอ (Portfolio Size):</strong> ใส่จำนวนเงินทุนทั้งหมดของคุณ</li>
            <li className="flex items-start gap-2"><Shield className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" /> <strong>ความเสี่ยงต่อไม้ (Risk %):</strong> แนะนำที่ 1-2% เพื่อป้องกันการล้างพอร์ต ระบบจะคำนวณขนาดไม้ (Position Size) ให้อัตโนมัติ</li>
          </ul>
        </motion.div>

        {/* Step 2 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-[#13002b]/80 to-[#0a001a]/80 p-6 rounded-xl border border-fuchsia-500/30 shadow-[0_4px_20px_rgba(217,70,239,0.1)]"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 font-bold text-xl border border-fuchsia-500/50">2</div>
            <h3 className="text-xl font-bold text-white">หาจังหวะเข้าเทรด (Market Analysis)</h3>
          </div>
          <p className="text-slate-300 mb-4 leading-relaxed">
            ใช้หน้า <span className="text-fuchsia-400 font-semibold">ภาพรวมตลาด (Dashboard)</span> เพื่อดูเหรียญที่มีการเคลื่อนไหวที่น่าสนใจ:
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2"><BarChart2 className="w-4 h-4 text-fuchsia-400 mt-0.5 shrink-0" /> <strong>Top 20 Volume:</strong> เลือกเหรียญที่มีสภาพคล่องสูงจากตารางด้านบน</li>
            <li className="flex items-start gap-2"><Zap className="w-4 h-4 text-fuchsia-400 mt-0.5 shrink-0" /> <strong>AI Alerts:</strong> รอรับการแจ้งเตือนจากระบบ AI เมื่อพบรูปแบบกราฟที่เข้าเงื่อนไข (เช่น Breakout, RSI Divergence)</li>
          </ul>
        </motion.div>

        {/* Step 3 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-[#13002b]/80 to-[#0a001a]/80 p-6 rounded-xl border border-lime-500/30 shadow-[0_4px_20px_rgba(132,204,22,0.1)]"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-lime-500/20 flex items-center justify-center text-lime-400 font-bold text-xl border border-lime-500/50">3</div>
            <h3 className="text-xl font-bold text-white">วิเคราะห์เชิงลึก (Deep Analysis)</h3>
          </div>
          <p className="text-slate-300 mb-4 leading-relaxed">
            เมื่อคลิกที่เหรียญหรือการแจ้งเตือน ระบบจะพาไปหน้า <span className="text-lime-400 font-semibold">วิเคราะห์กราฟ</span>:
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2"><Target className="w-4 h-4 text-lime-400 mt-0.5 shrink-0" /> <strong>AI Explanation Card:</strong> อ่านบทวิเคราะห์จาก AI ทางด้านขวา เพื่อดูเหตุผลในการเข้าเทรด จุดตัดขาดทุน (SL) และจุดทำกำไร (TP)</li>
            <li className="flex items-start gap-2"><Target className="w-4 h-4 text-lime-400 mt-0.5 shrink-0" /> <strong>ตรวจสอบกราฟ:</strong> ดูกราฟ TradingView ทางซ้ายเพื่อยืนยันด้วยตาของคุณเองอีกครั้งก่อนตัดสินใจ</li>
          </ul>
        </motion.div>

        {/* Step 4 */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-[#13002b]/80 to-[#0a001a]/80 p-6 rounded-xl border border-amber-500/30 shadow-[0_4px_20px_rgba(245,158,11,0.1)]"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xl border border-amber-500/50">4</div>
            <h3 className="text-xl font-bold text-white">บันทึกและประเมินผล (Trade Journal)</h3>
          </div>
          <p className="text-slate-300 mb-4 leading-relaxed">
            การเทรดที่ดีต้องมีการจดบันทึก ใช้หน้า <span className="text-amber-400 font-semibold">Trade Journal</span> เพื่อ:
          </p>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2"><BookOpen className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> <strong>บันทึกหลัง review:</strong> เมื่อ setup candidate ผ่าน risk gate แล้ว ให้ตรวจสอบความเสี่ยงด้วยตัวเองก่อนบันทึกลง Journal</li>
            <li className="flex items-start gap-2"><TrendingUp className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> <strong>ติดตาม Win Rate:</strong> เมื่อปิดไม้ (Close Trade) ระบบจะคำนวณสถิติความแม่นยำและ PnL ให้คุณเห็นพัฒนาการของตัวเอง</li>
          </ul>
        </motion.div>
      </div>

      {/* Pro Tips */}
      <div className="mt-8 bg-[#111827] p-6 rounded-xl border border-slate-800">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="text-yellow-400" /> เทคนิคเพิ่มเติม (Pro Tips)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
          <div className="bg-black/30 p-4 rounded-lg">
            <strong className="text-cyan-400 block mb-1">อย่าเทรดทุกสัญญาณ (Filter Signals)</strong>
            AI เป็นเพียงผู้ช่วยวิเคราะห์ คุณควรเลือกเทรดเฉพาะสัญญาณที่ตรงกับระบบเทรดของคุณและมี Risk/Reward (R/R) มากกว่า 1:1.5 เสมอ
          </div>
          <div className="bg-black/30 p-4 rounded-lg">
            <strong className="text-fuchsia-400 block mb-1">วินัยคือหัวใจสำคัญ (Discipline)</strong>
            ตั้ง Stop Loss ทุกครั้งที่เข้าเทรด และอย่าเลื่อน Stop Loss ออกเมื่อราคาผิดทาง ปล่อยให้ระบบ Risk Management ทำงานของมัน
          </div>
        </div>
      </div>
    </div>
  );
};
