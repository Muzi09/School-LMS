/**
 * Mock Data & Storage Helper for Academic Arrangement & Faculty Substitution
 * 
 * Supports:
 * - Specific shared in/out boundary times across Periods 1 to 8 + Recess
 * - Day-wise teacher schedules (Monday to Saturday)
 * - Multi-date selection & multi-teacher arrangement
 * - Real-time free teacher resolution (excluding teachers occupied with regular lectures or already assigned an arrangement)
 * - Workload counter per teacher for the day (how many arrangement lectures assigned)
 * - Persistent LocalStorage sync
 */

export const PERIODS = [
  { id: 1, number: 1, label: "P1", name: "Period 1", startTime: "08:30", endTime: "09:15", isBreak: false },
  { id: 2, number: 2, label: "P2", name: "Period 2", startTime: "09:15", endTime: "10:00", isBreak: false },
  { id: 3, number: 3, label: "P3", name: "Period 3", startTime: "10:00", endTime: "10:45", isBreak: false },
  { id: 4, number: 4, label: "P4", name: "Period 4", startTime: "10:45", endTime: "11:30", isBreak: false },
  { id: "break", number: null, label: "Break", name: "Recess", startTime: "11:30", endTime: "12:05", isBreak: true },
  { id: 5, number: 5, label: "P5", name: "Period 5", startTime: "12:05", endTime: "12:50", isBreak: false },
  { id: 6, number: 6, label: "P6", name: "Period 6", startTime: "12:50", endTime: "01:35", isBreak: false },
  { id: 7, number: 7, label: "P7", name: "Period 7", startTime: "01:35", endTime: "02:20", isBreak: false },
  { id: 8, number: 8, label: "P8", name: "Period 8", startTime: "02:20", endTime: "03:00", isBreak: false },
]

// The 10 boundary times shared between period boxes (08:30 to 03:00)
export const TIMELINE_BOUNDARIES = [
  "08:30",
  "09:15",
  "10:00",
  "10:45",
  "11:30",
  "12:05",
  "12:50",
  "01:35",
  "02:20",
  "03:00",
]

export const TEACHERS = [
  {
    id: "t1",
    name: "Dr. Rajesh Sharma",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    initials: "RS",
    department: "Science",
    subject: "Physics",
    designation: "PGT Senior Faculty",
    phone: "+91 98112 34567",
  },
  {
    id: "t2",
    name: "Ms. Sunita Verma",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    initials: "SV",
    department: "Mathematics",
    subject: "Mathematics",
    designation: "TGT Faculty",
    phone: "+91 98223 45678",
  },
  {
    id: "t3",
    name: "Mr. Amitav Ghosh",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    initials: "AG",
    department: "English",
    subject: "English Core",
    designation: "PGT English",
    phone: "+91 98334 56789",
  },
  {
    id: "t4",
    name: "Ms. Neha Kulkarni",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    initials: "NK",
    department: "Social Science",
    subject: "History & Civics",
    designation: "TGT Social Studies",
    phone: "+91 98445 67890",
  },
  {
    id: "t5",
    name: "Mr. Vikramaditya Singh",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    initials: "VS",
    department: "Physical Education",
    subject: "Physical Education",
    designation: "Sports Director",
    phone: "+91 98556 78901",
  },
  {
    id: "t6",
    name: "Ms. Priya Nair",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    initials: "PN",
    department: "Science",
    subject: "Chemistry",
    designation: "PGT Chemistry",
    phone: "+91 98667 89012",
  },
  {
    id: "t7",
    name: "Mr. David Robinson",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
    initials: "DR",
    department: "Computer Science",
    subject: "Informatics Practices",
    designation: "IT Head",
    phone: "+91 98778 90123",
  },
  {
    id: "t8",
    name: "Ms. Ananya Roy",
    avatar: "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80",
    initials: "AR",
    department: "Languages",
    subject: "Hindi",
    designation: "TGT Hindi",
    phone: "+91 98889 01234",
  },
  {
    id: "t9",
    name: "Mr. Rohit Batra",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    initials: "RB",
    department: "Commerce",
    subject: "Accountancy",
    designation: "PGT Commerce",
    phone: "+91 98990 12345",
  },
  {
    id: "t10",
    name: "Ms. Deepa Menon",
    avatar: "https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=150&auto=format&fit=crop&q=80",
    initials: "DM",
    department: "Science",
    subject: "Biology",
    designation: "TGT Science",
    phone: "+91 98101 23456",
  },
]

// Day-specific schedules for teachers
// Keys: 1..8 representing periods 1 through 8. null represents a FREE period.
export const TEACHER_SCHEDULES = {
  t1: {
    // Dr. Rajesh Sharma (Physics)
    MONDAY: {
      1: { class: "9A", subject: "Maths", room: "Room 102" },
      2: { class: "12A", subject: "Physics", room: "Room 301" },
      3: null, // Free
      4: { class: "10B", subject: "Physics", room: "Room 204" },
      5: null, // Free
      6: { class: "9A", subject: "Physics", room: "Room 102" },
      7: { class: "11B", subject: "Physics", room: "Room 303" },
      8: null, // Free
    },
    TUESDAY: {
      1: null, // Free
      2: { class: "11A", subject: "Physics", room: "Lab 2" },
      3: { class: "9A", subject: "Maths", room: "Room 102" },
      4: null, // Free
      5: { class: "12A", subject: "Physics", room: "Room 301" },
      6: { class: "10B", subject: "Physics", room: "Room 204" },
      7: null, // Free
      8: { class: "11B", subject: "Physics", room: "Room 303" },
    },
    WEDNESDAY: {
      1: { class: "9A", subject: "Maths", room: "Room 102" },
      2: null, // Free
      3: { class: "12A", subject: "Physics", room: "Room 301" },
      4: { class: "11A", subject: "Physics", room: "Lab 2" },
      5: null, // Free
      6: { class: "9A", subject: "Physics", room: "Room 102" },
      7: { class: "10B", subject: "Physics", room: "Room 204" },
      8: null, // Free
    },
    THURSDAY: {
      1: { class: "11A", subject: "Physics", room: "Lab 2" },
      2: { class: "9A", subject: "Maths", room: "Room 102" },
      3: null, // Free
      4: { class: "12A", subject: "Physics", room: "Room 301" },
      5: { class: "10B", subject: "Physics", room: "Room 204" },
      6: null, // Free
      7: null, // Free
      8: { class: "11B", subject: "Physics", room: "Room 303" },
    },
    FRIDAY: {
      1: null, // Free
      2: { class: "12A", subject: "Physics", room: "Room 301" },
      3: { class: "9A", subject: "Maths", room: "Room 102" },
      4: { class: "11A", subject: "Physics", room: "Lab 2" },
      5: null, // Free
      6: { class: "9A", subject: "Physics", room: "Room 102" },
      7: { class: "11B", subject: "Physics", room: "Room 303" },
      8: null, // Free
    },
    SATURDAY: {
      1: { class: "9A", subject: "Maths", room: "Room 102" },
      2: { class: "11A", subject: "Physics", room: "Lab 2" },
      3: null, // Free
      4: { class: "12A", subject: "Physics", room: "Room 301" },
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },

  t2: {
    // Ms. Sunita Verma (Mathematics)
    MONDAY: {
      1: null, // Free in P1 on Monday!
      2: { class: "10A", subject: "Maths", room: "Room 201" },
      3: { class: "9B", subject: "Maths", room: "Room 103" },
      4: null, // Free
      5: { class: "10C", subject: "Maths", room: "Room 205" },
      6: null, // Free
      7: { class: "8A", subject: "Maths", room: "Room 004" },
      8: { class: "8B", subject: "Maths", room: "Room 005" },
    },
    TUESDAY: {
      1: { class: "9B", subject: "Maths", room: "Room 103" },
      2: null, // Free
      3: { class: "10A", subject: "Maths", room: "Room 201" },
      4: { class: "10C", subject: "Maths", room: "Room 205" },
      5: null, // Free
      6: { class: "8A", subject: "Maths", room: "Room 004" },
      7: null, // Free
      8: { class: "8B", subject: "Maths", room: "Room 005" },
    },
    WEDNESDAY: {
      1: null, // Free
      2: { class: "10A", subject: "Maths", room: "Room 201" },
      3: null, // Free
      4: { class: "9B", subject: "Maths", room: "Room 103" },
      5: { class: "10C", subject: "Maths", room: "Room 205" },
      6: null, // Free
      7: { class: "8A", subject: "Maths", room: "Room 004" },
      8: null, // Free
    },
    THURSDAY: {
      1: { class: "10A", subject: "Maths", room: "Room 201" },
      2: null, // Free
      3: { class: "9B", subject: "Maths", room: "Room 103" },
      4: null, // Free
      5: { class: "8A", subject: "Maths", room: "Room 004" },
      6: { class: "10C", subject: "Maths", room: "Room 205" },
      7: null, // Free
      8: null, // Free
    },
    FRIDAY: {
      1: null, // Free
      2: { class: "10A", subject: "Maths", room: "Room 201" },
      3: { class: "9B", subject: "Maths", room: "Room 103" },
      4: null, // Free
      5: null, // Free
      6: { class: "10C", subject: "Maths", room: "Room 205" },
      7: { class: "8A", subject: "Maths", room: "Room 004" },
      8: { class: "8B", subject: "Maths", room: "Room 005" },
    },
    SATURDAY: {
      1: { class: "10A", subject: "Maths", room: "Room 201" },
      2: { class: "9B", subject: "Maths", room: "Room 103" },
      3: null,
      4: null,
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },

  t3: {
    // Mr. Amitav Ghosh (English)
    MONDAY: {
      1: { class: "11B", subject: "English", room: "Room 303" },
      2: null, // Free in P2!
      3: { class: "11A", subject: "English", room: "Room 301" },
      4: { class: "12B", subject: "English", room: "Room 304" },
      5: null, // Free
      6: null, // Free
      7: { class: "10B", subject: "English", room: "Room 204" },
      8: { class: "9C", subject: "English", room: "Room 105" },
    },
    TUESDAY: {
      1: null, // Free
      2: { class: "11B", subject: "English", room: "Room 303" },
      3: null, // Free
      4: { class: "11A", subject: "English", room: "Room 301" },
      5: { class: "12B", subject: "English", room: "Room 304" },
      6: null, // Free
      7: { class: "10B", subject: "English", room: "Room 204" },
      8: null, // Free
    },
    WEDNESDAY: {
      1: { class: "11A", subject: "English", room: "Room 301" },
      2: { class: "12B", subject: "English", room: "Room 304" },
      3: null, // Free
      4: null, // Free
      5: { class: "11B", subject: "English", room: "Room 303" },
      6: { class: "9C", subject: "English", room: "Room 105" },
      7: null, // Free
      8: null, // Free
    },
    THURSDAY: {
      1: null, // Free
      2: { class: "11A", subject: "English", room: "Room 301" },
      3: { class: "12B", subject: "English", room: "Room 304" },
      4: null, // Free
      5: null, // Free
      6: { class: "11B", subject: "English", room: "Room 303" },
      7: { class: "10B", subject: "English", room: "Room 204" },
      8: null, // Free
    },
    FRIDAY: {
      1: { class: "11B", subject: "English", room: "Room 303" },
      2: null, // Free
      3: null, // Free
      4: { class: "11A", subject: "English", room: "Room 301" },
      5: { class: "12B", subject: "English", room: "Room 304" },
      6: null, // Free
      7: { class: "9C", subject: "English", room: "Room 105" },
      8: { class: "10B", subject: "English", room: "Room 204" },
    },
    SATURDAY: {
      1: { class: "11A", subject: "English", room: "Room 301" },
      2: null,
      3: { class: "12B", subject: "English", room: "Room 304" },
      4: null,
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },

  t4: {
    // Ms. Neha Kulkarni (History & Civics)
    MONDAY: {
      1: { class: "8B", subject: "History", room: "Room 005" },
      2: null, // Free in P2
      3: null, // Free in P3
      4: { class: "7A", subject: "Civics", room: "Room 001" },
      5: { class: "9A", subject: "History", room: "Room 102" },
      6: { class: "10A", subject: "Civics", room: "Room 201" },
      7: null, // Free in P7
      8: null, // Free in P8
    },
    TUESDAY: {
      1: null,
      2: { class: "8B", subject: "History", room: "Room 005" },
      3: { class: "7A", subject: "Civics", room: "Room 001" },
      4: null,
      5: { class: "10A", subject: "Civics", room: "Room 201" },
      6: { class: "9A", subject: "History", room: "Room 102" },
      7: null,
      8: null,
    },
    WEDNESDAY: {
      1: { class: "7A", subject: "Civics", room: "Room 001" },
      2: null,
      3: { class: "8B", subject: "History", room: "Room 005" },
      4: null,
      5: null,
      6: { class: "9A", subject: "History", room: "Room 102" },
      7: { class: "10A", subject: "Civics", room: "Room 201" },
      8: null,
    },
    THURSDAY: {
      1: null,
      2: { class: "7A", subject: "Civics", room: "Room 001" },
      3: null,
      4: { class: "8B", subject: "History", room: "Room 005" },
      5: { class: "9A", subject: "History", room: "Room 102" },
      6: null,
      7: null,
      8: { class: "10A", subject: "Civics", room: "Room 201" },
    },
    FRIDAY: {
      1: { class: "8B", subject: "History", room: "Room 005" },
      2: null,
      3: { class: "7A", subject: "Civics", room: "Room 001" },
      4: null,
      5: { class: "10A", subject: "Civics", room: "Room 201" },
      6: null,
      7: { class: "9A", subject: "History", room: "Room 102" },
      8: null,
    },
    SATURDAY: {
      1: null,
      2: { class: "8B", subject: "History", room: "Room 005" },
      3: null,
      4: { class: "7A", subject: "Civics", room: "Room 001" },
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },

  t5: {
    // Mr. Vikramaditya Singh (Physical Ed)
    MONDAY: {
      1: null, // Free
      2: { class: "11B", subject: "Physical Ed", room: "Ground" },
      3: { class: "12A", subject: "Physical Ed", room: "Ground" },
      4: null, // Free
      5: null, // Free
      6: { class: "7B", subject: "Physical Ed", room: "Ground" },
      7: null, // Free
      8: null, // Free
    },
    TUESDAY: {
      1: null,
      2: null,
      3: { class: "11B", subject: "Physical Ed", room: "Ground" },
      4: { class: "12A", subject: "Physical Ed", room: "Ground" },
      5: null,
      6: null,
      7: { class: "7B", subject: "Physical Ed", room: "Ground" },
      8: null,
    },
    WEDNESDAY: {
      1: { class: "12A", subject: "Physical Ed", room: "Ground" },
      2: null,
      3: null,
      4: { class: "11B", subject: "Physical Ed", room: "Ground" },
      5: null,
      6: null,
      7: null,
      8: { class: "7B", subject: "Physical Ed", room: "Ground" },
    },
    THURSDAY: {
      1: null,
      2: { class: "12A", subject: "Physical Ed", room: "Ground" },
      3: null,
      4: null,
      5: { class: "11B", subject: "Physical Ed", room: "Ground" },
      6: { class: "7B", subject: "Physical Ed", room: "Ground" },
      7: null,
      8: null,
    },
    FRIDAY: {
      1: null,
      2: null,
      3: { class: "12A", subject: "Physical Ed", room: "Ground" },
      4: { class: "11B", subject: "Physical Ed", room: "Ground" },
      5: null,
      6: null,
      7: { class: "7B", subject: "Physical Ed", room: "Ground" },
      8: null,
    },
    SATURDAY: {
      1: { class: "11B", subject: "Physical Ed", room: "Ground" },
      2: null,
      3: null,
      4: { class: "12A", subject: "Physical Ed", room: "Ground" },
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },

  t6: {
    // Ms. Priya Nair (Chemistry)
    MONDAY: {
      1: { class: "12A", subject: "Chemistry", room: "Chem Lab" },
      2: { class: "11A", subject: "Chemistry", room: "Chem Lab" },
      3: null,
      4: null,
      5: { class: "10A", subject: "Chemistry", room: "Room 201" },
      6: { class: "9B", subject: "Chemistry", room: "Room 103" },
      7: null,
      8: null,
    },
    TUESDAY: {
      1: null,
      2: { class: "12A", subject: "Chemistry", room: "Chem Lab" },
      3: { class: "11A", subject: "Chemistry", room: "Chem Lab" },
      4: null,
      5: null,
      6: { class: "10A", subject: "Chemistry", room: "Room 201" },
      7: { class: "9B", subject: "Chemistry", room: "Room 103" },
      8: null,
    },
    WEDNESDAY: {
      1: null,
      2: null,
      3: { class: "12A", subject: "Chemistry", room: "Chem Lab" },
      4: { class: "11A", subject: "Chemistry", room: "Chem Lab" },
      5: { class: "10A", subject: "Chemistry", room: "Room 201" },
      6: null,
      7: { class: "9B", subject: "Chemistry", room: "Room 103" },
      8: null,
    },
    THURSDAY: {
      1: { class: "11A", subject: "Chemistry", room: "Chem Lab" },
      2: null,
      3: null,
      4: { class: "12A", subject: "Chemistry", room: "Chem Lab" },
      5: null,
      6: { class: "9B", subject: "Chemistry", room: "Room 103" },
      7: { class: "10A", subject: "Chemistry", room: "Room 201" },
      8: null,
    },
    FRIDAY: {
      1: { class: "12A", subject: "Chemistry", room: "Chem Lab" },
      2: { class: "11A", subject: "Chemistry", room: "Chem Lab" },
      3: null,
      4: null,
      5: { class: "10A", subject: "Chemistry", room: "Room 201" },
      6: null,
      7: null,
      8: { class: "9B", subject: "Chemistry", room: "Room 103" },
    },
    SATURDAY: {
      1: null,
      2: { class: "12A", subject: "Chemistry", room: "Chem Lab" },
      3: { class: "11A", subject: "Chemistry", room: "Chem Lab" },
      4: null,
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },

  t7: {
    // Mr. David Robinson (Informatics Practices)
    MONDAY: {
      1: null, // Free
      2: null, // Free
      3: { class: "11B", subject: "IP / Computer", room: "Comp Lab 1" },
      4: { class: "12B", subject: "IP / Computer", room: "Comp Lab 1" },
      5: { class: "8A", subject: "Computer", room: "Comp Lab 2" },
      6: null, // Free
      7: { class: "9A", subject: "Computer", room: "Comp Lab 1" },
      8: null, // Free
    },
    TUESDAY: {
      1: null,
      2: { class: "11B", subject: "IP / Computer", room: "Comp Lab 1" },
      3: null,
      4: { class: "12B", subject: "IP / Computer", room: "Comp Lab 1" },
      5: null,
      6: { class: "8A", subject: "Computer", room: "Comp Lab 2" },
      7: null,
      8: { class: "9A", subject: "Computer", room: "Comp Lab 1" },
    },
    WEDNESDAY: {
      1: { class: "12B", subject: "IP / Computer", room: "Comp Lab 1" },
      2: null,
      3: null,
      4: { class: "11B", subject: "IP / Computer", room: "Comp Lab 1" },
      5: { class: "9A", subject: "Computer", room: "Comp Lab 1" },
      6: null,
      7: null,
      8: { class: "8A", subject: "Computer", room: "Comp Lab 2" },
    },
    THURSDAY: {
      1: null,
      2: null,
      3: { class: "12B", subject: "IP / Computer", room: "Comp Lab 1" },
      4: { class: "11B", subject: "IP / Computer", room: "Comp Lab 1" },
      5: null,
      6: { class: "9A", subject: "Computer", room: "Comp Lab 1" },
      7: { class: "8A", subject: "Computer", room: "Comp Lab 2" },
      8: null,
    },
    FRIDAY: {
      1: { class: "11B", subject: "IP / Computer", room: "Comp Lab 1" },
      2: null,
      3: { class: "12B", subject: "IP / Computer", room: "Comp Lab 1" },
      4: null,
      5: null,
      6: { class: "8A", subject: "Computer", room: "Comp Lab 2" },
      7: { class: "9A", subject: "Computer", room: "Comp Lab 1" },
      8: null,
    },
    SATURDAY: {
      1: null,
      2: { class: "11B", subject: "IP / Computer", room: "Comp Lab 1" },
      3: { class: "12B", subject: "IP / Computer", room: "Comp Lab 1" },
      4: null,
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },

  t8: {
    // Ms. Ananya Roy (Hindi)
    MONDAY: {
      1: { class: "7A", subject: "Hindi", room: "Room 001" },
      2: { class: "8A", subject: "Hindi", room: "Room 004" },
      3: { class: "9A", subject: "Hindi", room: "Room 102" },
      4: null,
      5: null,
      6: { class: "10B", subject: "Hindi", room: "Room 204" },
      7: null,
      8: null,
    },
    TUESDAY: {
      1: null,
      2: { class: "7A", subject: "Hindi", room: "Room 001" },
      3: { class: "8A", subject: "Hindi", room: "Room 004" },
      4: { class: "9A", subject: "Hindi", room: "Room 102" },
      5: null,
      6: null,
      7: { class: "10B", subject: "Hindi", room: "Room 204" },
      8: null,
    },
    WEDNESDAY: {
      1: { class: "8A", subject: "Hindi", room: "Room 004" },
      2: null,
      3: { class: "7A", subject: "Hindi", room: "Room 001" },
      4: null,
      5: { class: "9A", subject: "Hindi", room: "Room 102" },
      6: { class: "10B", subject: "Hindi", room: "Room 204" },
      7: null,
      8: null,
    },
    THURSDAY: {
      1: null,
      2: { class: "8A", subject: "Hindi", room: "Room 004" },
      3: null,
      4: { class: "7A", subject: "Hindi", room: "Room 001" },
      5: null,
      6: { class: "9A", subject: "Hindi", room: "Room 102" },
      7: { class: "10B", subject: "Hindi", room: "Room 204" },
      8: null,
    },
    FRIDAY: {
      1: { class: "7A", subject: "Hindi", room: "Room 001" },
      2: null,
      3: { class: "8A", subject: "Hindi", room: "Room 004" },
      4: null,
      5: { class: "10B", subject: "Hindi", room: "Room 204" },
      6: null,
      7: { class: "9A", subject: "Hindi", room: "Room 102" },
      8: null,
    },
    SATURDAY: {
      1: { class: "7A", subject: "Hindi", room: "Room 001" },
      2: { class: "8A", subject: "Hindi", room: "Room 004" },
      3: null,
      4: null,
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },

  t9: {
    // Mr. Rohit Batra (Commerce)
    MONDAY: {
      1: null, // Free
      2: { class: "11-Com", subject: "Accountancy", room: "Room 305" },
      3: { class: "12-Com", subject: "Accountancy", room: "Room 306" },
      4: null, // Free
      5: null, // Free
      6: { class: "11-Com", subject: "Business", room: "Room 305" },
      7: null, // Free
      8: { class: "12-Com", subject: "Business", room: "Room 306" },
    },
    TUESDAY: {
      1: null,
      2: null,
      3: { class: "11-Com", subject: "Accountancy", room: "Room 305" },
      4: { class: "12-Com", subject: "Accountancy", room: "Room 306" },
      5: null,
      6: null,
      7: { class: "11-Com", subject: "Business", room: "Room 305" },
      8: { class: "12-Com", subject: "Business", room: "Room 306" },
    },
    WEDNESDAY: {
      1: { class: "11-Com", subject: "Accountancy", room: "Room 305" },
      2: { class: "12-Com", subject: "Accountancy", room: "Room 306" },
      3: null,
      4: null,
      5: null,
      6: { class: "11-Com", subject: "Business", room: "Room 305" },
      7: null,
      8: { class: "12-Com", subject: "Business", room: "Room 306" },
    },
    THURSDAY: {
      1: null,
      2: { class: "11-Com", subject: "Accountancy", room: "Room 305" },
      3: null,
      4: { class: "12-Com", subject: "Accountancy", room: "Room 306" },
      5: { class: "11-Com", subject: "Business", room: "Room 305" },
      6: null,
      7: null,
      8: { class: "12-Com", subject: "Business", room: "Room 306" },
    },
    FRIDAY: {
      1: null,
      2: null,
      3: { class: "11-Com", subject: "Accountancy", room: "Room 305" },
      4: { class: "12-Com", subject: "Accountancy", room: "Room 306" },
      5: null,
      6: { class: "11-Com", subject: "Business", room: "Room 305" },
      7: null,
      8: { class: "12-Com", subject: "Business", room: "Room 306" },
    },
    SATURDAY: {
      1: { class: "11-Com", subject: "Accountancy", room: "Room 305" },
      2: { class: "12-Com", subject: "Accountancy", room: "Room 306" },
      3: null,
      4: null,
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },

  t10: {
    // Ms. Deepa Menon (Biology)
    MONDAY: {
      1: null,
      2: null,
      3: { class: "10C", subject: "Biology", room: "Bio Lab" },
      4: { class: "9C", subject: "Biology", room: "Bio Lab" },
      5: { class: "11A", subject: "Biology", room: "Bio Lab" },
      6: null,
      7: null,
      8: null,
    },
    TUESDAY: {
      1: { class: "10C", subject: "Biology", room: "Bio Lab" },
      2: null,
      3: null,
      4: { class: "9C", subject: "Biology", room: "Bio Lab" },
      5: null,
      6: { class: "11A", subject: "Biology", room: "Bio Lab" },
      7: null,
      8: null,
    },
    WEDNESDAY: {
      1: null,
      2: { class: "10C", subject: "Biology", room: "Bio Lab" },
      3: null,
      4: null,
      5: { class: "9C", subject: "Biology", room: "Bio Lab" },
      6: null,
      7: { class: "11A", subject: "Biology", room: "Bio Lab" },
      8: null,
    },
    THURSDAY: {
      1: null,
      2: null,
      3: { class: "10C", subject: "Biology", room: "Bio Lab" },
      4: null,
      5: { class: "9C", subject: "Biology", room: "Bio Lab" },
      6: null,
      7: { class: "11A", subject: "Biology", room: "Bio Lab" },
      8: null,
    },
    FRIDAY: {
      1: { class: "10C", subject: "Biology", room: "Bio Lab" },
      2: null,
      3: null,
      4: { class: "9C", subject: "Biology", room: "Bio Lab" },
      5: null,
      6: null,
      7: { class: "11A", subject: "Biology", room: "Bio Lab" },
      8: null,
    },
    SATURDAY: {
      1: null,
      2: { class: "10C", subject: "Biology", room: "Bio Lab" },
      3: null,
      4: { class: "9C", subject: "Biology", room: "Bio Lab" },
      5: null,
      6: null,
      7: null,
      8: null,
    },
  },
}

/**
 * Get weekday name in uppercase from YYYY-MM-DD
 */
export function getWeekdayFromDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()
  } catch {
    return "MONDAY"
  }
}

/**
 * Get a teacher's schedule for a specific date
 */
export function getTeacherScheduleForDate(teacherId, dateStr) {
  const weekday = getWeekdayFromDate(dateStr)
  if (weekday === "SUNDAY") {
    return {}
  }
  const teacherWeek = TEACHER_SCHEDULES[teacherId] || {}
  return teacherWeek[weekday] || teacherWeek["MONDAY"] || {}
}

/**
 * Format date string into human-friendly representation
 * e.g. "Mon, 09 Nov 2026"
 */
export function formatDisplayDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split("-").map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

export function getTodayDateString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const STORAGE_KEY = "school_lms_arrangements_v2"

/**
 * Default initial sample arrangements
 */
const DEFAULT_SAMPLE_STATE = {
  // Map of date -> array of absent teacher IDs
  absentTeachersByDate: {
    // Today
    "2026-11-08": ["t1", "t4"],
    "2026-11-09": ["t1"],
  },
  // Map of `${date}_${absentTeacherId}_${periodNumber}` -> { substituteTeacherId, note, assignedAt }
  arrangements: {
    "2026-11-08_t1_1": {
      substituteTeacherId: "t2", // Ms. Sunita Verma is free in P1
      note: "Revision of Algebra basics",
      assignedAt: "2026-11-08T08:10:00",
    },
    "2026-11-08_t1_2": {
      substituteTeacherId: "t3", // Mr. Amitav Ghosh is free in P2
      note: "Class reading supervision",
      assignedAt: "2026-11-08T08:15:00",
    },
    "2026-11-08_t4_5": {
      substituteTeacherId: "t8", // Ms. Ananya Roy is free in P5
      note: "Supervise workbook questions",
      assignedAt: "2026-11-08T08:20:00",
    },
  },
}

export function loadArrangementData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Clean up any legacy "Auto-assigned by smart balance" notes
      if (parsed.arrangements) {
        for (const arr of Object.values(parsed.arrangements)) {
          if (arr.note === "Auto-assigned by smart balance") {
            arr.note = ""
          }
        }
      }
      return parsed
    }
  } catch {}

  const today = getTodayDateString()
  const initial = JSON.parse(JSON.stringify(DEFAULT_SAMPLE_STATE))
  // Normalize today's date into the default sample
  if (!initial.absentTeachersByDate[today]) {
    initial.absentTeachersByDate[today] = ["t1", "t4"]
    initial.arrangements[`${today}_t1_1`] = {
      substituteTeacherId: "t2",
      note: "Revision of Algebra formulas",
      assignedAt: new Date().toISOString(),
    }
    initial.arrangements[`${today}_t1_2`] = {
      substituteTeacherId: "t3",
      note: "Class reading supervision",
      assignedAt: new Date().toISOString(),
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
  } catch {}
  return initial
}

export function saveArrangementData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

export function resetArrangementData() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
  return loadArrangementData()
}

export const ABSENCE_TYPES = {
  FULL_DAY: "FULL_DAY",
  FIRST_HALF: "FIRST_HALF",
  SECOND_HALF: "SECOND_HALF",
  CUSTOM_PERIODS: "CUSTOM_PERIODS",
}

export const ABSENCE_TYPE_LABELS = {
  FULL_DAY: "Full Day",
  FIRST_HALF: "First Half (Morning)",
  SECOND_HALF: "Second Half (Afternoon)",
  CUSTOM_PERIODS: "Specific Periods",
}

export const BASE_TEACHER_SCHEDULE = {
  t1: TEACHER_SCHEDULES.t1?.MONDAY || {},
  t2: TEACHER_SCHEDULES.t2?.MONDAY || {},
  t3: TEACHER_SCHEDULES.t3?.MONDAY || {},
  t4: TEACHER_SCHEDULES.t4?.MONDAY || {},
  t5: TEACHER_SCHEDULES.t5?.MONDAY || {},
  t6: TEACHER_SCHEDULES.t6?.MONDAY || {},
  t7: TEACHER_SCHEDULES.t7?.MONDAY || {},
  t8: TEACHER_SCHEDULES.t8?.MONDAY || {},
  t9: TEACHER_SCHEDULES.t9?.MONDAY || {},
  t10: TEACHER_SCHEDULES.t10?.MONDAY || {},
}

/**
 * Returns duty count and specific period/class assignments for a substitute teacher on a given date
 */
export function getTeacherDutySummaryOnDate(teacherId, dateStr, arrangements = {}) {
  const duties = []
  if (!dateStr || !teacherId) return { count: 0, duties: [] }

  for (const [key, arr] of Object.entries(arrangements)) {
    if (key.startsWith(dateStr) && arr.substituteTeacherId === teacherId) {
      const parts = key.split("_")
      const absentTeacherId = parts[1]
      const periodNum = parseInt(parts[2], 10)

      const absentTeacher = TEACHERS.find((t) => t.id === absentTeacherId)
      const schedule = getTeacherScheduleForDate(absentTeacherId, dateStr)
      const slot = schedule[periodNum]

      duties.push({
        periodNum,
        periodLabel: `P${periodNum}`,
        class: slot?.class || "Class",
        subject: slot?.subject || absentTeacher?.subject || "Subject",
        absentTeacherName: absentTeacher?.name || "Teacher",
        note: arr.note || "",
      })
    }
  }

  // Sort duties by period number
  duties.sort((a, b) => a.periodNum - b.periodNum)
  return {
    count: duties.length,
    duties,
  }
}

/**
 * Smart Auto-Assign Algorithm:
 * For each uncovered period of the given absent teachers on a date,
 * finds all eligible free teachers and assigns the one with the lowest daily duty count.
 */
export function autoAssignForDate(dateStr, absentTeacherIds = [], currentArrangements = {}) {
  const updatedArrangements = { ...currentArrangements }
  let assignedCount = 0

  // Tally current duties per teacher on this date
  const dutyCounts = {}
  for (const t of TEACHERS) dutyCounts[t.id] = 0
  for (const [key, arr] of Object.entries(updatedArrangements)) {
    if (key.startsWith(dateStr) && arr.substituteTeacherId) {
      dutyCounts[arr.substituteTeacherId] = (dutyCounts[arr.substituteTeacherId] || 0) + 1
    }
  }

  for (const absentTeacherId of absentTeacherIds) {
    const schedule = getTeacherScheduleForDate(absentTeacherId, dateStr)

    for (let pNum = 1; pNum <= 8; pNum++) {
      const slot = schedule[pNum]
      if (!slot) continue // Free period for absent teacher, no arrangement needed

      const key = `${dateStr}_${absentTeacherId}_${pNum}`
      if (updatedArrangements[key]?.substituteTeacherId) {
        continue // Already assigned
      }

      // Find all teachers free in period pNum
      const candidates = []
      for (const teacher of TEACHERS) {
        // Can't substitute for oneself
        if (teacher.id === absentTeacherId) continue

        // Can't substitute if absent on this date
        if (absentTeacherIds.includes(teacher.id)) continue

        // Check if candidate is teaching regular scheduled class in this period
        const candSchedule = getTeacherScheduleForDate(teacher.id, dateStr)
        if (candSchedule[pNum]) continue

        // Check if candidate is already assigned as substitute in this period on this date
        let alreadySubbedInThisPeriod = false
        for (const [otherKey, otherArr] of Object.entries(updatedArrangements)) {
          if (
            otherKey.startsWith(dateStr) &&
            otherKey.endsWith(`_${pNum}`) &&
            otherArr.substituteTeacherId === teacher.id
          ) {
            alreadySubbedInThisPeriod = true
            break
          }
        }
        if (alreadySubbedInThisPeriod) continue

        candidates.push({
          teacherId: teacher.id,
          dutyCount: dutyCounts[teacher.id] || 0,
        })
      }

      // Sort candidate by least duty count
      candidates.sort((a, b) => a.dutyCount - b.dutyCount)

      if (candidates.length > 0) {
        const chosen = candidates[0]
        updatedArrangements[key] = {
          substituteTeacherId: chosen.teacherId,
          note: "",
          assignedAt: new Date().toISOString(),
        }
        dutyCounts[chosen.teacherId] = (dutyCounts[chosen.teacherId] || 0) + 1
        assignedCount++
      }
    }
  }

  return { updatedArrangements, assignedCount }
}

export const SAMPLE_ARCHIVED_RECORDS = [
  {
    id: "rec_1",
    date: "2026-11-06",
    teacherId: "t1",
    absenceType: "FULL_DAY",
    reason: "Attending CBSE Regional Science Conference",
    affectedPeriods: [1, 2, 4, 6, 7],
    substitutes: {
      1: { substituteTeacherId: "t2", note: "Chapter 4 numerical practice", assignedAt: "2026-11-06T08:15:00" },
      2: { substituteTeacherId: "t3", note: "Discipline supervision during quiz", assignedAt: "2026-11-06T08:15:00" },
      4: { substituteTeacherId: "t6", note: "Cover Newton laws revision", assignedAt: "2026-11-06T08:15:00" },
      6: { substituteTeacherId: "t5", note: "Sports theory / self-study", assignedAt: "2026-11-06T08:15:00" },
      7: { substituteTeacherId: "t8", note: "Hindi writing practice", assignedAt: "2026-11-06T08:15:00" },
    },
    publishedAt: "2026-11-06T08:20:00",
    publishedBy: "Principal Office",
  },
  {
    id: "rec_2",
    date: "2026-11-05",
    teacherId: "t4",
    absenceType: "FIRST_HALF",
    reason: "Medical checkup appointment",
    affectedPeriods: [1, 3, 4],
    substitutes: {
      1: { substituteTeacherId: "t3", note: "History textbook reading", assignedAt: "2026-11-05T08:05:00" },
      3: { substituteTeacherId: "t2", note: "Civics Constitution notes distribution", assignedAt: "2026-11-05T08:05:00" },
      4: { substituteTeacherId: "t7", note: "Self-study supervision", assignedAt: "2026-11-05T08:05:00" },
    },
    publishedAt: "2026-11-05T08:10:00",
    publishedBy: "Principal Office",
  },
  {
    id: "rec_3",
    date: "2026-11-04",
    teacherId: "t6",
    absenceType: "FULL_DAY",
    reason: "Casual leave / Personal",
    affectedPeriods: [2, 3, 5, 7],
    substitutes: {
      2: { substituteTeacherId: "t1", note: "Chemistry equation balance worksheet", assignedAt: "2026-11-04T08:15:00" },
      3: { substituteTeacherId: "t10", note: "Combined Science review", assignedAt: "2026-11-04T08:15:00" },
      5: { substituteTeacherId: "t5", note: "Reading time", assignedAt: "2026-11-04T08:15:00" },
      7: { substituteTeacherId: "t8", note: "Silent study", assignedAt: "2026-11-04T08:15:00" },
    },
    publishedAt: "2026-11-04T08:25:00",
    publishedBy: "Vice Principal",
  },
  {
    id: "rec_4",
    date: "2026-11-03",
    teacherId: "t2",
    absenceType: "SECOND_HALF",
    reason: "Family emergency",
    affectedPeriods: [5, 6, 8],
    substitutes: {
      5: { substituteTeacherId: "t1", note: "Maths formulas test", assignedAt: "2026-11-03T11:45:00" },
      6: { substituteTeacherId: "t7", note: "IT lab assignment time", assignedAt: "2026-11-03T11:45:00" },
      8: { substituteTeacherId: "t3", note: "General knowledge quiz", assignedAt: "2026-11-03T11:45:00" },
    },
    publishedAt: "2026-11-03T11:50:00",
    publishedBy: "Principal Office",
  },
]
